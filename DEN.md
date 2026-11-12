# The monitoring desk and Anne's Den

Design notes, evidence and decisions for the work in `prompts/annes-den.md`. This file holds counts and public names
only. The analyst's reports are client material: they are read through the Drive connector in a session and never
copied here.

## 0. Phase 0 - baseline and evidence (11 November 2026, no code changed)

Baseline: worker `2026-11-05.studio-p52`, page `?v=r39`, branch head `0bf7f9d`. The full gate (`node tests/run.mjs all`) passed
181 of 181 on it, two suites with their Firefox and WebKit parts skipped because those engines are not installed here.

### 0.1 What was read

| Series | Cadence | Reports held | Read for this | Note |
|---|---|---|---|---|
| AEP national | daily | 36 | the latest 30 (29 Sep - 11 Nov) | |
| AEP Victoria | daily | 68 | the latest 30 (29 Sep - 11 Nov) | |
| Firearms (Shooters Union) | weekly | 7 | the latest 5 (June - 9 Nov) | |
| MCA national, MCA Victoria | weekly | - | not read | the documents are not shared with the session's account |

The MCA desks are built from the lexicon as it stands; their gap list is open until the documents can be read.

### 0.2 Her format, as written (not as assumed)

The prompt said seven sections. The reports have more, and the two clients differ.

- **AEP (both regions)**: Executive Summary; Key Narratives; Traditional Media Coverage; Social Media Activity;
  Influencer and Political Activity; Sentiment and Tone; Momentum Assessment; Risks and Implications (a named list:
  reputational, media, political, policy or regulatory, social media, campaign escalation or community campaign,
  industry influence, direct targeting of the client); Bottom Line; Recommended Posture (prose, opening "AEP should
  continue monitoring ..."); Source List. Header: client, date, "Reporting window: <day>-<day>".
- **Firearms**: Executive Summary; Today's Key Judgement; Key Developments; News environment (volume, reach, core
  narratives); Organisational and influencer activity; Assessment of Activist Momentum, with three ratings - "Overall
  activity level", "Media risk", "Social risk"; Implications for the client; Bottom Line; Source List.
- **Ratings vocabulary** (both): a level - Low, Low to Moderate, Moderate, Moderate to High, High - and for activity a
  trend - Stable, Escalating. The posture line is prose, not a fixed list.
- A report runs to about four to five thousand words.

So a desk's `sections` and `ratings` are data per desk, seeded from the above, not one fixed list of seven.

### 0.3 What her evidence is made of

Links in the source lists of the reports read (top 80 domains per series):

| Series | Links | Social | Subscriber or metered outlets | Monitoring-service links | Aggregators and release wires | Open web |
|---|---|---|---|---|---|---|
| AEP national | 432 | 198 (46%) | 56 | 4 | 22 | 146 |
| AEP Victoria | 326 | 125 (38%) | 41 | 8 | 43 | 105 |
| Firearms | 303 | 163 (54%) | 20 | 5 | 17 | 98 |

Social links by platform:

| Series | X | Facebook | Instagram | YouTube | Reddit | LinkedIn | TikTok | Threads |
|---|---|---|---|---|---|---|---|---|
| AEP national | 117 | 33 | 33 | 6 | 6 | 3 | 0 | 0 |
| AEP Victoria | 87 | 15 | 19 | 2 | 0 | 2 | 0 | 0 |
| Firearms | 56 | 39 | 34 | 32 | 2 | 0 | 0 | 0 |
| **All** | **260** | **87** | **86** | **40** | **8** | **5** | **0** | **0** |

Three things follow, and they change the order of the work:
1. **X is her largest channel by a wide margin (260 of 486 social links), and most of those posts are from ordinary
   accounts, not organisations.** In the AEP national series about a fifth of the X links are from a registered
   organisation or official; the rest were found by searching a term. Keyword search on X is therefore the single
   largest route, and it already exists on the Mac collector (`tools/reach-x.py`). What it lacks is her terms.
2. Facebook and Instagram are next and about equal. Most Facebook links are a post id under a page id, and most
   Instagram links are a bare post or reel, so the account cannot be read from the link: these were found by search
   or by a monitoring service, not by watching a page.
3. LinkedIn is 5 links in 1,061. TikTok and Threads are none.

### 0.4 The gap list

Checked against the worker with `GET /reddit/issues` (the lexicon), `GET /sources` (321 seeded sources) and
`GET /entities/test` (the entity register).

**Topics.** The earlier reading was wrong in one respect and it matters: the `aep:gas` **wide** matcher fires on the
bare word "gas", so nearly every sentence in her reports is already tagged `gas`. The gaps are these.

| Gap | Effect |
|---|---|
| Gas taxation (windfall tax, gas export tax, super-profits tax, PRRT, "gas tax now") is tagged `gas` and nothing else | It cannot be told apart from gas reservation; no filter, no baseline, no spike of its own |
| No **tight** trigger matches any of it | The Sentinel never fires on the campaign her reports lead with |
| None of it is a search term (`q`) | The keyword pass on X and Reddit never looks for it |
| COP31, PRRT, VNI West, a bare hashtag (`#taxthegas`) match nothing | Not collected |
| Scott Reef, Browse, Golden Beach, Bass Strait, data centres are tagged only because the sentence also says "gas" or "Woodside" | A post that names the place alone is missed |
| "super profits tax on gas exporters" is tagged `mca:mining` | A gas story lands on the wrong client |
| "fossil fuel subsidies" is tagged `mca:ftc` | Worth a look: it is the activists' name for fuel tax credits, so this may be intended |
| Firearms: ownership caps, licensed owners and theft are tagged but trigger nothing; the Alannah and Madeline Foundation, the Shooters Fishers and Farmers Party (tagged `vicnats:regional`, through "Farmers"), junior shooting and the campaign slogan match nothing useful | Same three effects |

**Outlets not in the Source Registry** (cited in the reports): The Point, National Tribune, Echo (Northern Rivers),
Canberra CityNews, Region, The Energy, QNews, Energy Matters, Yahoo News Australia, Tasmanian Country, Pulse Tasmania,
Region Riverina, About Regional; and the campaign sites of Friends of the Earth Melbourne, The Wilderness Society, the
Conservation Council of WA, Rewiring Australia, the Smart Energy Council, 350 Australia, Gun Control Australia, the
Alannah and Madeline Foundation and Shooters Union. Present already: ABC, AFR, The Australian, Guardian, Mirage,
RenewEconomy, The Australia Institute, The New Daily, The Mandarin, the Greens, The West, SBS, the Nine and News Corp
metros, Market Forces, Climate Council, Greenpeace, Environment Victoria, Lock the Gate, Rising Tide, ACF, GetUp,
Capital Brief, The Saturday Paper, Energy News Bulletin, Sporting Shooter, SSAA, SIFA.

**Actors not in the entity register**: the Victorian Greens and WA Greens; senators and members David Shoebridge,
Steph Hodgins-May, Nick McKim, Jordon Steele-John, Monique Ryan, Sophie Scamps, Ellen Sandell, Helen Haines, Bridget
McKenzie, Matt Canavan, Kellie Sloane, Yasmin Catley, Philip Donato, Roy Butler, Paul Toole; Environment Victoria,
Friends of the Earth Melbourne, The Wilderness Society, the Conservation Council of WA, the Australian Marine
Conservation Society, Rewiring Australia, the Smart Energy Council, Climate Integrity, Energy Consumers Australia;
Beach Energy, Amplitude Energy, Origin Energy; the Alannah and Madeline Foundation, the Shooters Fishers and Farmers
Party, Shooting Australia, NSW Farmers, the Libertarian Party, the Animal Justice Party. (Sitting members may arrive
through `POST /entities/sync-mps`; the seed covers them so the desk does not depend on that having been run.)

**Two defects found in the entity matcher** (to be fixed test-first in Phase 1):
- "Sarah Hanson-Young" is matched as Pauline Hanson's entity: the alias "Hanson" treats the hyphen as a word boundary.
- "David Pocock" and "Barbara Pocock" both resolve to one entity `pocock`. They are different senators in different
  parties, so stance toward one is being counted for the other.

### 0.5 Which layer can reach what

| Channel | Layer 1 (official) | Layer 2 (reach, signed in on the Mac) | Layer 3 (keyless) | Neither |
|---|---|---|---|---|
| X | - | keyword search and replies: **exists today** (`twitter`), needs her terms | timelines of registered accounts (`xSyndSweep`), needs her actors in `x_watch` | - |
| Facebook | named pages' posts and counts (`FBPD` PagePosts); reach of a news URL (`UrlShares`) | search and profiles (agent-reach `facebook`, experimental) | - | comment text (no route found on either layer); private groups |
| Instagram | a business account's posts (Business Discovery); hashtag search, 30 hashtags a week (to be verified) | user search, profiles, a user's posts (agent-reach `instagram`, experimental) | - | comment text; keyword search beyond hashtags |
| YouTube | comments with `YOUTUBE_KEY` | keyword search (agent-reach `youtube`, no sign-in) | channel feeds, comments, captions | - |
| Reddit | - | exists today (`rdt`) | - | - |
| LinkedIn | clients' own pages only | agent-reach offers job search only | - | organisation posts by others |
| TikTok, Threads | - | no agent-reach channel | TikTok oEmbed for one post | everything else |

Agent-reach as read on 11 November 2026 (its English README and install notes): Facebook and Instagram are
"experimental" channels that need a login ("works, but the platform fights automation harder and it can break at any
time"); it copies the login already in the person's Chrome and recommends a secondary account, stating that platforms
"may restrict accounts used for automation"; it is read-only; installation is from its GitHub release (the PyPI package
of the same name is a different project). It names no TikTok or Threads channel, and its LinkedIn channel reads job
listings. Neither it nor the Supermetrics connectors return comment text for Facebook or Instagram.

Supermetrics connectors as answered on 11 November 2026: `FBPD` (no sign-in) - Page, PagePosts, UrlShares; `IGPD2`
(signed in) - BusinessDiscoveryAccount, BusinessDiscoveryMedia, HashtagSearchMedia (recent or top); `MAL` (Meta Ad
Library, **not signed in**: the owner signs it in from the connector) - keyword or page-id search, country, political
and issue ads.

**Neither public-data connector is usable today.** Two live reads were tried on 11 November 2026 under D2 (a news
organisation's public Facebook page and its Instagram account, five rows each) and both were refused:
`LICENSE_DATA_SOURCE_NOT_AVAILABLE` - Facebook Public Data and Instagram Public Data are not in the agency's Supermetrics
licence. The Windsor connector has one advertising account connected and no `instagram_public` account. So layer 1 for
Facebook and Instagram needs one of: the two data sources added to the Supermetrics subscription; an Instagram public
account connected in Windsor; or, for the worker's own route, Meta permissions (Business Discovery on the agency's
Instagram business account; Instagram Public Content Access for hashtags; Page Public Content Access for Facebook
pages). Until one of those exists, **layer 2 is the only working route to Facebook and Instagram**, and the layer 1
code is built unproven against a real answer. Six of the eight reads under D2 remain.

### 0.6 What this changes in the plan

- **Phase 1 carries more weight than expected.** New issues with tight triggers and search terms unlock the largest
  channel (X search on the existing collector) before any new collector is written.
- **Phase 2 is infrastructure first**: the watch register, one ingest route with the relevance and naming rules
  enforced in the worker, canonical permalinks and engagement snapshots - shared by both layers - then the Graph and
  Supermetrics routes behind a probe, since neither can deliver today.
- **Phase 3 order**: Facebook, Instagram, YouTube search. **Recommended against for now: LinkedIn** (5 links in 1,061,
  and no backend that reads posts), **TikTok and Threads** (no link in any report read, no backend). They stay in the
  coverage table as "not collected", with the reason. The owner can overrule.
- **Comment text on Facebook and Instagram is out of reach on both layers** as surveyed. The prompt assumed layer 2
  would bring it. The only remaining route is the signed-in browser parser, the most fragile and the most exposed part
  of the design; it is left out unless the owner asks for it after seeing the rest work.
- **Subscriber outlets are about one link in eight** (117 of 1,061). The Phase 4 design stands.
- **The brief's shape is per desk** (0.2).

### 0.7 Decisions (defaults in force until the owner changes them)

D1 registered public actors named on their own posts only; D2 at most eight live Supermetrics reads (two made, both
refused by the licence);
D3 layer 1 worker route built behind configuration; D4 one stated model call per draft, `DEN_DAILY_CALLS` 20, the
morning draft off; D5 copy as rich text, `.md`, `.html`, Slack summary; D6 read role reads, full role drafts and
approves; D7 every reach channel built switched off, started only by a person signing in on the Mac; D8 subscriber
outlets only through the agency's own subscription and only once clearance is recorded on the source; D9 the
monitoring-export importer built.

## 1. Release 1 - coverage (build `2026-11-11.studio-p53`)

What changed, each proven by a case in `tests/den-lexicon-worker.mjs` that failed on p52:

| Change | Where | Case |
|---|---|---|
| Gas taxation is an issue (`gastax`) with its own trigger, matcher and six search terms | `CLIENT_ISSUES` | LX1, LX5 |
| Gas projects and approvals (`gasprojects`): a place named alone is tagged; a holiday park, a beach and a wine region are not | `CLIENT_ISSUES`; `gas` no longer matches a bare "Scarborough" or "Barossa" | LX2, LX5 |
| Electrification and the gas phase-out (`electrify`) | `CLIENT_ISSUES` | LX3, LX5 |
| COP31, fossil fuel exports, data centres with an energy angle, VNI West | `energy` | LX3 |
| Ownership caps, the foundation, the party, junior shooting, the slogan | `firearms` | LX4 |
| An American gas tax, a British windfall tax and a Virginian data centre are refused at the gate; a term naming an Australian place vouches | `AU_RX`, `AU_QUERY_RX`, mirrored in `tools/reach-reddit.py` | LX6, SR2 |
| The page and the Mac collector carry the worker's lexicon exactly | `tools/lexicon-sync.mjs` | LX8, SR2 |
| "Hanson-Young" is not Hanson; two senators Pocock are two people | `entityMatcher()` | EN1 |
| 42 actors and topics added to the register (104 to 146) | `ENTITY_SEED` | EN2 |
| 28 outlets, campaign sites and official sources added (235 to 263 seeds) | `SOURCE_SEED_EXT` | SR1 |

Two things found on the way that were already wrong and are now held by a test: the page's copy of the lexicon had
drifted from the worker (the `gas` and `econ` matchers differed), and "super profits tax on gas exporters" was tagged
for the Minerals Council only.

The search terms for the keyword pass went from 85 to 109. On the Mac collector that is twenty-four more X and Reddit
searches a sweep; `--issue aep` narrows a sweep to one client.

Not verifiable here, for the owner's first run after deploying:
- **The 28 seed addresses.** `POST /sources/sweep {ids:[...]}` or the Sources view; a seed that fails shows its reason.
- **The triggers on real traffic.** The Sentinel's `gastax`, `gasprojects` and `electrify` baselines build over
  fourteen days; an alert before then is measured against a thin baseline.
- **The X keyword pass with the new terms**, on the Mac: `python3 tools/reach-x.py --key $AXIOM_KEY --issue aep`.
- **The entity seed** refreshes rows nobody has edited; an edited row keeps the operator's aliases.

## 2. Release 2 - the ground every collector stands on (build `2026-11-11.studio-p54`, page `?v=r41`)

Phase 0 found that no official route to Facebook or Instagram works today (0.5). So this release builds what both
layers share, and builds the official routes behind a probe that says what each still needs.

**The watch register** (D1 `den_watch`). One client's list of what is read for it: accounts, hashtags, terms, outlets
and public Facebook groups, each `proposed`, `active`, `off` or `dismissed`, with who added it, who decided and why.
What a person types is normalised (a handle loses its @, a page comes out of its address, a hashtag loses its #).
`actor_kind` (org, official, media) marks an account as a public actor that may be named on its own posts; an account
without it is read and never named. A proposal is not read until a person approves it; a dismissal needs a reason
and is never proposed again. Routes: `GET /den/watch?ns=&kind=&platform=&status=`, `GET /den/plan?ns=&platform=`
(read); `POST /den/watch/add|propose|decide|update|delete` (full). A register is never read without naming its client.

**One way in** (`POST /signals/ingest {ns, layer, via, rows, comments, fb}`, full; `signalsIngest()`). Every collector
on every layer hands its posts here, and the rules are enforced here so no collector can skip them:

| Rule | How |
|---|---|
| One post, one address | `canonPermalink(platform, url)`; an account page or a script address is not a post and is refused |
| Relevance | a post is kept only when `issueTag()` finds one of the client's issues or one of its active terms matches; the rest are counted |
| The Australian gate | a post that came from a search or a hashtag passes `auRelevant()` with the term struck out first |
| Names (D1) | `meta.actor {id, name, kind}` is written from the register row only, and only for an account with an `actor_kind`. Nothing a collector sends about a person is read |
| One row across layers | a post already held is updated: the newer count wins, an older read never overwrites it, `meta.layers` records every layer that found it |
| Counts move | one snapshot row a Sydney day (kind `sig_eng`), the later read of a day replacing the earlier |
| Comments | the words and the tone under their thread; never the author |
| Facebook reach of news | `fb: [{url, reactions, comments, shares}]` is written as `meta.fb` on the news row |
| Walls | a register row of another client ties nothing and names nobody |

At most 500 rows a request. A guest link cannot collect.

**The official routes, behind the probe** (`GET /meta/status?probe=1` now lists four more steps, each optional and
named): `igDiscoverySweep()` (Business Discovery, needs `META_TOKEN` and the new var `META_IG_USER`),
`igHashtagSweep()` (hashtag search; the allowance of thirty unique hashtags in seven days is kept in KV `ig_hashtags`,
a hashtag inside the window is free, the thirty-first is refused and named and reaches no provider),
`fbPublicSweep()` (other organisations' pages; Meta's refusal is returned as `ppca_missing`, in words, never as an
empty success). The cron runs the Instagram routes only when `META_IG_USER` is set and the Facebook route only with
`META_PUBLIC_PAGES=1`, so nothing is asked of Meta every two hours just to be refused. `metaAdLibrary()` searches each
desk's approved terms beside the issue labels.

**The Supermetrics route** (`tools/den-pull-plan.py`, `tools/supermetrics2signals.py`). The plan tool prints the
day's queries from `GET /den/plan`; the converter turns the saved answers into one ingest payload and can push it.
Neither can be proven until the two public-data sources are on the licence: the field ids come from the connector's
field discovery, not from a live answer.

**In the app.** Signals has Facebook and Instagram tabs. A post shows the registered actor's name where there is one,
shares and views, when its counts were read, and which layer read it (L1, L2). The Coverage tab's Facebook and
Instagram rows say how each is read, what is set and what cannot be reached.

One post cannot always be matched across layers: Facebook's opaque `pfbid` address has no numeric equivalent a
collector can compute. A post found once by its numeric id and once by `pfbid` may be held twice.

**Not verified against Meta's documentation.** The prompt asked for the hashtag limit to be checked and cited.
`developers.facebook.com` cannot be reached from the session's sandbox, so these are written from knowledge of the
Graph API and are unconfirmed: the allowance of thirty unique hashtags in a rolling seven days per Instagram account;
that hashtag search needs the Instagram Public Content Access feature; the `recently_searched_hashtags` edge the
probe reads; the permissions Business Discovery needs; that other organisations' Facebook pages need Page Public
Content Access. The pages to read are Meta's "Hashtag Search", "Business Discovery" and "Page Public Content Access".
What settles each in practice is the probe on the deployed worker, which reports Meta's own answer step by step. If
the limit differs, it is one constant (`IG_HASHTAG_LIMIT`).

Harnesses: `tests/den-collect-worker.mjs` (18), `tests/den-tools-test.py` (23), one case in
`tests/signals-browser.mjs` (8), shared cases `tests/fixtures/den/permalinks.json` (29).

For the owner, to switch a route on:
- **Supermetrics**: add Facebook Public Data and Instagram Public Data to the subscription. Then, in a Claude Code
  session with the connector: `python3 tools/den-pull-plan.py --ns aep --key $AXIOM_KEY`, run the printed queries,
  save each answer under the printed name, and
  `python3 tools/supermetrics2signals.py out.json --ns aep --key $AXIOM_KEY fbposts=fbposts.json ... --push`.
- **Instagram from the worker**: set the var `META_IG_USER` to the agency's Instagram business account id, then
  open `/meta/status?probe=1`. Hashtag search also needs Instagram Public Content Access (an app review).
- **Facebook from the worker**: Page Public Content Access (an app review), then the var `META_PUBLIC_PAGES=1`.
- A register is empty until someone adds to it: `POST /den/watch/add {ns, kind, platform, value, name, actor_kind}`
  for now; the Den's Watch tab (release 6) is the place for it.

## 3. Release 3 - the signed-in layer for Facebook, Instagram and YouTube (build `2026-11-11.studio-p55`, page `?v=r42`)

Decision D7, as the owner asked on 11 November 2026: the Mac collector reads social platforms through a person's
signed-in session. **Nothing is switched on by this release.** A platform collects only after a person signs in to it
on the Mac, having read the warning. Platforms the owner has switched on so far: Facebook (the owner's Mac, user heshhomefolder,
11 November 2026, through opencli; s.3.2).

**Corrected by the first live run (11 November 2026, the owner's Mac; s.3.1 below).** Agent Reach v1.5.0 as installed
has no `facebook`, `instagram`, `youtube` or `login` command at all: its commands are `setup, install, configure,
doctor, uninstall, skill, format, transcribe, check-update, watch, version`. It checks and installs other tools; it
does not search. The table below is what was *read from documentation* and is **not true of the installed tool**.
Until the owner chooses a backend that really answers, layer 2 for Facebook, Instagram and YouTube collects nothing,
and `--channels` says so as `no_command`.

**What agent-reach was expected to do.** Read from its documentation and channel source on
11 November 2026 (`agent-reach <channel> <action>`, one line of JSON, `NEED_LOGIN` / `PLATFORM_BLOCKED` /
`RATE_LIMITED` as named errors):

| Channel | Reads | Does not |
|---|---|---|
| Facebook | posts found by keyword search | a page's timeline, comments, groups |
| Instagram | a named account's recent posts | comments, post search, hashtags |
| YouTube | videos found by keyword search | comments (the worker reads those afterwards, and captions) |

That is narrower than the prompt assumed, and it is said rather than worked around: **comment text on Facebook and
Instagram is collected by no layer**, and a registered Facebook page's own timeline arrives only through the official
route (Page Public Content Access) or when a post of it matches a search term. TikTok and Threads have no agent-reach
channel and no link in any report read; LinkedIn's channel reads job listings. None of the three is built.

**On the Mac** (`tools/reach_social.py`, wired into `tools/reach-agent.py`):
- `--channels` says what the machine can collect and why not; `--login facebook|instagram|youtube` shows the warning
  (the terms, the account risk, and never a profile that administers a client's ad account, Page or Business asset),
  asks that question for Facebook and Instagram, asks for the platform's name, then opens agent-reach's own sign-in
  window. The tool never sees a password and never reads a cookie.
- A channel is offered to the worker only while it is usable: installed, signed in, not paused, not switched off.
  That is rechecked every ten minutes.
- Pace: one read at a time, never under ten seconds apart on a platform (agent-reach's own floor; not a setting).
  Caps a run and a day per platform in `~/.axiom-reach/reach.json` (defaults: Facebook 30 / 120, Instagram 40 / 150,
  YouTube 40 / 200); what a cap held back is reported.
- What stops a sweep, each under its own name: a login wall (`<platform>_unavailable`), a verification
  (`<platform>_challenge`: stops at once, pauses the platform on that Mac for 24 hours, never retries, never solves
  anything), a slow-down (the run ends), an answer that cannot be read (`<platform>_parse_failed`; three in a row pause
  the platform). A read that returned items with nothing readable is a failure, never a quiet day.
- Posts go to `POST /signals/ingest` as layer 2, so relevance, the Australian gate, one row a post and naming are the
  worker's. The `author` agent-reach returns is never read. Log lines are scrubbed of anything shaped like a cookie, a
  token or a password before they are printed or sent.

**In the worker.**
- A Facebook or Instagram job goes to the official route when Meta has granted it, else to a live collector that
  offers the platform, else it runs in the worker and fails at once with what to set. `ytsearch` (YouTube keyword
  search) is the collector's.
- A job waiting three minutes for a collector that is not connected fails as `no_collector`, with the command.
- `GET /den/reach` (read) shows the collectors, what is switched off and the last verification per platform; `POST
  /den/reach {off: [...], clear}` (full) is the kill switch. A platform switched off is not queued, and a job queued
  earlier is not handed out.
- A verification reported by a collector is posted to Slack (`_default`) once a day a platform, kept for the coverage
  table, and nothing is retried.
- `denReachCron()` queues the morning's jobs (05:00 to 10:00 Sydney, once a day): a Facebook and a YouTube keyword
  pass for each desk, Instagram where an account is registered, one X keyword pass - only for platforms a live
  collector offers and that are not switched off. No model call. A plan job nobody served in twelve hours is cancelled.
- The registers' X accounts join the keyless timeline sweep (`xSyndSweep`); a registered public actor is named.
- A YouTube video found by search carries its video id, so `youtubeEnrich` reads its comments and captions.

Harnesses: `tests/reach-channels-test.py` (52, a stand-in agent-reach), `tests/den-reach-worker.mjs` (7), and the
collector's state in `tests/signals-browser.mjs`.

**Not verifiable here, and the most likely thing to need adjusting on the Mac.** No platform was contacted and
nothing was signed in to. The tests prove the collector's behaviour against agent-reach *as documented*: the command
form, the `items` list, the error codes. They do not prove agent-reach's real answers - above all **which fields carry
the interaction counts**, which its documentation does not list (the collector looks for them under several common
names in each item and its `raw`). The first real run is the test:

```
uv tool install https://github.com/Panniantong/Agent-Reach/releases/latest/download/agent-reach.zip && agent-reach setup
python3 tools/reach-agent.py --channels
python3 tools/reach-agent.py --login youtube        # the lowest risk: start here
python3 tools/reach_social.py youtube --ns aep --key $AXIOM_KEY --dry-run --out /tmp/yt.json
```

Read `/tmp/yt.json`: every row should have an address, words and counts. If the counts are missing, the field names
in `_ALIASES` need the ones agent-reach uses. Then Facebook and Instagram, each with `--login` first.
(Superseded: with v1.5.0 the second line reports `no_command` for all three and the rest cannot run.)

### 3.1 The first live run of the Mac collector (11 November 2026; build `2026-11-11.studio-p59`, page `?v=r45`)

What the owner saw, what was wrong, what changed. Proven against real output: only the `agent-reach doctor` and
`agent-reach --help` shapes (the owner's paste, kept in `tests/fixtures/den/agent-reach-*-1.5.0.txt`). Everything
about X below is proven against stand-ins only.

- **A. The agent kept claiming X jobs it could not run.** `x` stayed in the offer after `x_unavailable`, so sixteen
  queued X jobs were claimed and failed one by one. Now (`tools/reach-agent.py`: `X_DOWN`, `x_check`, `x_usable`,
  `offering`, `serve`): twitter-cli is asked once at the start (`twitter status`, never a search) and X is not offered
  when its search cannot work; one job that learns it takes X out of the offer at once and says so once; every poll
  tells the worker (`/bridge/next?...&down=x`); twitter-cli is asked again every ten minutes and X is offered again
  when it works; `--sources x` does not override it; `--channels` prints "search is unavailable" with the command.
  **Queued X jobs, decided:** they are failed in words, not kept. A topic's X job is a week-window search that the
  next run of the topic queues again, so a stale one has no value. The worker does it: `POST /bridge/done` with
  `x_unavailable` removes X from that collector's offer and fails every X job still waiting
  (`bridgeExpire {source:'x', maxAgeMs:0}`) unless another live collector offers X; a new X job fails at once
  (`jobTail`, no three-minute wait when a live collector says the platform is down); result
  `{error:'no_collector', why:'x_unavailable', detail}` with the command first. `/bridge/status` agents carry `down`.
- **A, the wider hole.** `no_collector` was only ever decided when someone tailed the job. `bridgeExpire(env, {})`
  now runs every tick: a job queued thirty minutes (`BRIDGE_STALE_MS`) with no live collector offering its source is
  failed `no_collector`. The morning plan (`who='plan'`) keeps its own twelve-hour rule.
- **B. The message was cut before the remedy.** `X_REMEDY` then `X_CAUSE` in `tools/reach-x.py`: what to do is
  inside the first 300 characters; the report carries 1,100 and the console line 1,200 (the worker's line limit).
- **C. Why the keywords came round twice.** Not a retry. Every topic run (`topicsCron`: the two stalest active topics
  a window) queued one X job whatever was connected, and nothing ever removed an unserved one, so the queue held one
  X job per keyword per run. Now `topicRun` queues an X job only when a live collector offers X, at most one waiting
  job a topic (`already waiting`), and otherwise says once why not (`out.xSkipped`). **The stand-in:** the worker's
  keyless timeline reader (`xSyndSweep`) already files MPs' own posts; `topicMpPosts()` finds those that carry every
  word of the keyword (rows with `meta.mp` only) and `topicResults` returns them under `x` marked `held: true` with
  an `xNote`. Nothing new is fetched; it is their own posts only - no replies, no search. A trade-off to know: a
  topic researched while the Mac is asleep gets no X search that day (before, the job waited for the Mac).
- **D. Upstream.** Checked on PyPI from the sandbox: twitter-cli 0.8.5 (17 March 2026) is the newest release; its
  header generator is the package `xclienttransaction` (newest 1.0.3, 26 June 2026). **Both newest releases still
  contain the unguarded `.search(...).group(1)`** (`x_client_transaction/utils.py` lines 59 and 61), and 1.0.2 is the
  release that changed how the page is read. So `uv tool upgrade twitter-cli` can only help if the Mac is behind
  those; if it is already on them there is no released fix. twitter-cli's GitHub repository could not be read from
  the sandbox, so nothing is known here about unreleased fixes.
- **E. agent-reach reported every channel as "unknown".** The parser looked for a JSON line or English status words;
  the real answer is marked text in Chinese (U+2705 usable, `[!]` needs configuration or sign-in, `[X]` not
  installed, plus one sentence listing the channels still to unlock), and `doctor --text` is not accepted.
  `doctor_marks()` reads that; `commands()` reads the subcommands from `agent-reach --help`; a channel with no
  command is `no_command` (never usable, whatever the doctor ticks); an answer in neither shape is `unreadable`;
  `login()` stops before any question when there is no `login` command. On the real output all three channels are
  `no_command` and nothing is offered. **The search and read commands in `CHANNELS` do not exist in v1.5.0.**
  Not built, because it is the owner's decision (D7 names agent-reach as the backend): reading YouTube search through
  `yt-dlp` directly, which is what agent-reach's own YouTube channel installs.

Harnesses: `tests/reach-agent-test.py` (26, new), `tests/reach-channels-test.py` (80), `tests/den-reach-worker.mjs`
(9), `tests/topics-worker.mjs` (4, new).

### 3.2 After the deploy (11 November 2026, evening; tools only, worker and page unchanged)

**Seen on the owner's Mac and the live worker (build p59):** the deploy verified; the agent started with one line
"not offering X", offered `reddit, render` and claimed no X job; `--channels` printed X as "search is unavailable"
and the three social channels as `no_command`. twitter-cli there is installed with pipx at 0.8.5 with
xclienttransaction 1.0.3 (the newest of both), and the unreleased twitter-cli 0.8.6 (commit 7c634e0) was tried and
did not fix X search. **So there is no fix upstream, released or not; X keyword search waits on those projects.**
Homebrew's Python refuses `pip install`, so the collector has its own environment, `~/.axiom-reach/venv`, and is
run with `~/.axiom-reach/venv/bin/python`.

Changed after that, at the owner's word ("fix all"):

- **The X message knows what is installed.** `x_versions()` asks the Python of twitter-cli's own environment (pipx or
  uv; nothing fetched) and `x_remedy()` says which case the machine is in: on the newest releases, "Nothing to do on
  this Mac: no fix is available yet"; behind them, the upgrade command for the installer that was used, both
  packages; unreadable, the general advice. `X_NEWEST` holds the versions known to carry the fault.
- **The background agent runs with the Python that installed it** (`launchd_command`): install it with
  `~/.axiom-reach/venv/bin/python tools/reach-agent.py --install-launchd` and it sees Playwright and yt-dlp. It used
  a bare `python3`, which on this Mac has neither.
- **YouTube keyword search reads through yt-dlp. Decision D7 amended, 11 November 2026, the owner:** agent-reach
  cannot search YouTube, so `reach_social.py` uses yt-dlp directly for the `youtube` channel when agent-reach has no
  such command (`backend()`): `yt-dlp "ytsearchN:<term>" --flat-playlist --dump-json --no-warnings --ignore-config`,
  public search, no sign-in, no cookies. The rules are unchanged: the ten-second floor and the daily cap; "Sign in to
  confirm you're not a bot" is a challenge (stop, 24 hours, no retry, no cookies handed over); a line that is not
  JSON is `youtube_parse_failed`; a 429 ends the run; the channel's and uploader's names and ids are never carried.
  A person still switches it on once: `--login youtube` asks for the platform's name and records who (there is
  nothing to sign in to); until then the status is `not_switched_on`. Facebook and Instagram are unchanged.
  **Not proven on a real machine:** the field names (`id`, `title`, `description`, `view_count`, `timestamp`,
  `upload_date`) are yt-dlp's as recalled. The dry run below is the test.

```
~/.axiom-reach/venv/bin/pip install -U "yt-dlp[default]"
~/.axiom-reach/venv/bin/python tools/reach-agent.py --channels          # youtube: not_switched_on
~/.axiom-reach/venv/bin/python tools/reach-agent.py --login youtube     # type: youtube
~/.axiom-reach/venv/bin/python tools/reach_social.py youtube --ns aep --key $AXIOM_KEY --dry-run --out /tmp/yt.json
~/.axiom-reach/venv/bin/python tools/reach-agent.py --install-launchd   # the background agent, with this Python
```

Harnesses: `tests/reach-agent-test.py` (37), `tests/reach-channels-test.py` (96).
### 3.3 Facebook and Instagram through opencli, the tool agent-reach installs for them (11 November 2026, at the owner's request; no worker or page change)

Section 3.2 gave YouTube a backend and left Facebook and Instagram with nothing to run. The owner then asked for those
too ("i need all these"): the tool agent-reach itself installs for them. Read from agent-reach 1.5.0's own channel files on the
owner's Mac: Facebook and Instagram are `opencli <site> ...` (it drives the Chrome a person is already signed in to),
YouTube is `yt-dlp`. Decision D7 is unchanged - a person signs in by hand, public content only, the pace, the caps, the
24-hour pause - and only the command the collector runs is new.

- **When it applies.** `use_native(channel)`: agent-reach is absent or has no command for the channel, and the tool is
  on the machine (`NATIVE` = Facebook and Instagram, found through `_which`). An agent-reach that one day has the commands is still used first.
- **YouTube** keeps the yt-dlp path of s.3.2 (`backend()`, `run_ytsearch()`); a second yt-dlp path written here was
  removed when the two were merged.
- **Facebook keyword search**: `opencli facebook search <term> --limit N -f json --window background`. Its columns are
  index, title, text, url. `title` can be a person's or a page's name and is never read; a result whose address is not
  a post (a page, a person) is dropped. **It returns no counts and no date**, so a Facebook row from this route has
  words and an address only.
- **Instagram, registered accounts' posts**: `opencli instagram user <account> --limit N -f json --window background`.
  Its documented columns are index, caption, likes, comments, type, date - **no address**. The collector takes `url`,
  `link`, `permalink` or a `shortcode` when the JSON carries one; when no post carries any, the sweep fails as
  `instagram_no_address` in words. It is never guessed and never an empty success.
- **Only reads.** opencli can also like, follow, comment, post, add a friend and join a group. `OPENCLI_READS` is the
  whole list of what this collector may run (`facebook search`, `facebook whoami`, `instagram user`,
  `instagram whoami`); anything else raises before a process starts. `login` runs only inside `login()`, typed for by a
  person.
- **Switching on.** `python3 tools/reach-agent.py --login facebook` (or `instagram`): the warning, the client-admin
  question, the platform's name typed, then `opencli <site> login`; it is recorded as switched on only when
  `opencli <site> whoami` then reports someone signed in. Until then the channel is `needs_login` and is not offered.
  Each job asks `whoami` once before it sweeps; the account's name is never logged or stored.
- **Refusals** are read from what the tool said (its error stream; its output only when that is not data, so a post
  that says "checkpoint" is a post): a verification stops the sweep and pauses the platform 24 hours, a slow-down stops
  it, signed out is `needs_login`, a disconnected browser bridge says to run `opencli doctor`.
- **A refused sign-in pauses the platform.** When `opencli <site> login` or the check after it answers "too many
  requests" or a verification, nothing is switched on, the platform is paused 24 hours, and a second `--login` inside
  the day stops before any question.
- **What has run for real (the owner's Mac, 11 November 2026).** `opencli doctor` clean; `--login facebook` confirmed
  through `whoami` and recorded; `--login instagram` refused by Instagram with HTTP 429 (before the pause existed: it is
  not to be tried again until the next day). **No sweep has run**: the first Facebook job went to the worker's own
  Graph route because the collector on the Mac was the `main` copy, which had no Facebook path. The answers of
  `opencli facebook search` and `opencli instagram user` in `tests/reach-channels-test.py` are stand-ins; the
  Instagram address is the likeliest thing to fail.
- **The first Facebook sweep (the owner's Mac, 11 November 2026, opencli 1.8.6): no posts.** The job ran on the Mac
  and `opencli facebook search "fuel tax credit"` answered two results - a group and a page - and no post; "diesel
  rebate" the same way. opencli's Facebook commands are add-friend, events, feed, friends, groups, join-group, login,
  marketplace-*, memories, notifications, profile, search and whoami: its search has no posts filter and nothing reads
  a page's own posts. **So this backend cannot collect public Facebook posts by keyword.** The collector now says so
  (`facebook_no_posts`, three in a row pause the platform) instead of "0 items, 0 posts". Open for the owner: whether
  the official routes, or leaving Facebook to the news rows' reach counts.
- **Checked the same evening.** opencli 2.0.3 (the newest on npm, read with `npx` in the sandbox, nothing installed on
  the Mac): the same Facebook commands and the same search with only `--limit`, so upgrading changes nothing; its
  Instagram `search` finds users, not posts. Supermetrics, asked live from a session: `FBPD` (report types Page,
  PagePosts, UrlShares) and `IGPD2` both answer `LICENSE_DATA_SOURCE_NOT_AVAILABLE` for licence 2083978 - the route
  in s.2 is built and still waits on the licence. Meta's Page Public Content Access was not probed from here (it needs
  the AXIOM key: `GET /meta/status?probe=1`).
- **Not collected still:** comment text on Facebook and Instagram, a Facebook page's own timeline, Instagram keyword
  search.

Owner's steps: `--login youtube` (s.3.2);
with Chrome open and `opencli doctor` green, `--login facebook` and `--login instagram` on a profile that administers
no client asset; record each under D7 with who and when; restart the agent.

## 4. Release 4 - subscriber news, newsletters and monitoring exports (build `2026-11-11.studio-p56`, page `?v=r43`)

Decision D8, as the owner asked on 11 November 2026. About 117 of the 1,061 links in the reports read point at
mastheads that are subscribers-only or metered (0.3). Until now AXIOM held their headlines and nothing else.
**Nothing is switched on by this release.** A source is read through a subscription only after two things a person
does: records on the source what covers reading it for monitoring, and signs in to it on the Mac. Sources cleared so
far: none recorded.

**How a source is read** is now a fact on the source: open, metered, subscribers only, a subscriber newsletter, or an
official source. The mastheads the reports cite are marked from a seed list (The Australian, the News Corp metros, the
AFR, Capital Brief, The West, Energy News Bulletin as subscribers only; the Nine metros and the Canberra Times as
metered); the seed is a starting point a person corrects in the Sources view, not a finding about any publisher's terms.

**Clearing a source** (Sources view, full key): choose how it is read, write what covers reading it for monitoring
(the agency's subscription, or its copyright licence; twelve characters at least), press Record. The source then shows
who cleared it, when, and the words they wrote. Withdraw takes it back. **Whether a given subscription's terms or the
agency's copyright licence do cover monitoring use is a question for the person who records it; the software records
the answer and cannot check it.**

**What is read, and how much.** Headlines are found as before (feed, sitemap, listing page, Google News). Only rows
tagged with a client issue, under 48 hours old, from a cleared source go on to the subscriber read: at most eight
queued a tick and twenty a source a day, and only while a collector with that publisher's profile is connected. One
article can also be asked for by hand (`POST /fulltext/gated {id}`). The collector does not download the paper.

**Where the text goes.** Not into the archive row. It is kept in its own table, which no list, feed, summary, partner
or review-link route reads; the archive row keeps its public summary and says only that a subscriber read exists.
One function hands the text out: to a signed-in member of the team, with a thirty-word excerpt and the note that a
brief quotes no more than that with the link. A guest link and a keyless reader are refused with the reason. A page
that still shows its paywall after sign-in is reported as `subscription_wall` and never saved as an article.

**On the Mac:**

```
pip install playwright && playwright install chromium
python3 tools/reach-agent.py --login news:afr --url https://www.afr.com/login   # a person signs in; the profile is kept for that publisher
python3 tools/reach-agent.py --channels                                         # "gated" appears once a profile exists
```

**Newsletters and monitoring exports** (decision D9: built; whether to use it is the analyst's call):

```
python3 tools/den-import.py eml=~/Downloads/briefings --source capitalbrief --ns aep --key $AXIOM_KEY          # says what it would file
python3 tools/den-import.py eml=~/Downloads/briefings --source capitalbrief --ns aep --key $AXIOM_KEY --apply
python3 tools/den-import.py monitor=~/Downloads/export.csv --ns aep --key $AXIOM_KEY --apply
```

A newsletter is subscriber content: its source must be cleared, its words go to the same separate table, and the
sender is not read. A monitoring export is read by its column names (headline, link, date, outlet, summary), the
journalist's name is not carried, and the answer counts what AXIOM did not already hold - which is itself a measure of
coverage.

**Differences from the prompt, and why.**
- The prompt put the subscriber read on the existing `render` job with a `profile` parameter and stored the result on
  the archive row with `meta.gated`. It is a bridge source of its own (`gated`) and a table of its own instead:
  marking a row and trusting every present and future route to check the mark is how such text leaks; a separate
  table cannot be returned by a route that does not know it exists.
- No `reach` method was added to a source's method chain. How a source is read is the `access` field; discovery is
  unchanged.
- Links inside a newsletter are **not** followed. The newsletter's own words are filed; following links is not built.
- The thirty-word limit is in `gatedExcerpt` now; the brief's own check (`denClean`) arrives with the Den in release 6.

Harnesses: `tests/den-gated-worker.mjs` (9), `tests/reach-channels-test.py` (62), `tests/den-tools-test.py` (30),
`tests/sources-browser.mjs` (15).

**Not verifiable here.** No publisher was contacted and nothing was signed in to. The persistent browser profile, the
sign-in flow and each publisher's page shape (whether `extract_article` finds the article body behind a real
subscription, and whether a real paywall page comes back short enough to be recognised as a wall) are proven only
against stand-ins. The first real read on the Mac is the test; read the job log for `subscription_wall`.

## 5. Release 5 - keyword discovery (build `2026-11-11.studio-p57`, no page change)

The owner asked for collection to be widened "regarding her keywords" and for "new relevant keywords" to be found.
Release 1 put her keywords in the lexicon by hand. This release is how the lexicon keeps growing without a developer:
the system proposes, with evidence, and a person approves or dismisses. **Nothing proposed is read by any collector
or tagger until a person approves it.**

**Where proposals come from** (`POST /den/discover {ns, days}`; once a day for each desk that has a register; no
model call, nothing collected, only a reading of what the archive already holds):

| Proposer | What it reads | When it proposes |
|---|---|---|
| Terms | phrases of one to three words in rows filed under the desk's issues | in at least 4 rows from 2 sources, and 3 times as common as in everything else held |
| The comments | two- and three-word phrases in comments under the desk's posts | in at least 5 comments across 3 threads, twice as common as in other comments |
| Hashtags | the desk's rows and registered accounts' own posts | on 3 posts |
| Accounts and public groups | handles named and profiles linked in registered accounts' own posts | on 3 posts |
| Outlets | sites linked from the desk's rows | on 3 rows, and not in the Source Registry |
| Narratives | the words live narratives on the desk's issues keep using | used in two fifths of a narrative's rows and matched by nothing in the lexicon |
| Her reports | `tools/den-mine-reports.py` on a folder of exported reports | named in at least 2 reports |

Each proposal carries a line that says why ("In 14 of 212 rows on this desk in 14 days, from 6 sources; 6.2 times as
common as in everything else held"), up to five rows as evidence, and a score. A proposal a person dismissed (with a
reason) is never proposed again, and neither are the words inside it.

**Preview before deciding** (`GET /den/preview?ns=&term=`): the rows of the last seven days that carry the term - how
many are already on the desk, how many it would add, by channel, how many of those say something Australian, and
twenty of them to read. A term that would mostly add foreign rows says so before anyone approves it. It is a reading
of what was collected: a term nobody has searched for is rarely held, and the preview says that too.

**What approval does.** The term joins the search terms and the wide matcher of the issue it is filed under, for
every collector on every layer, through the one published lexicon (`GET /reddit/issues`). New rows that carry it are
filed under that issue from then on. It does **not** change what counts as a spike: the Sentinel's triggers stay
hand-written. Rows collected before the approval are not re-tagged.

**Guards.** Sixty active terms a desk at most. A term that does not name Australia is marked, because what it finds
on Reddit, X and Bluesky must then say something Australian to be kept. Any term can be switched off. A term approved
thirty days ago that has matched nothing since is marked for review.

**One optional model step** (`POST /den/themes`, one call, behind a button that states it): groups the waiting
proposals into themes with a line on why each might matter, and a "Probably noise" group. It changes no status.

**Differences from the prompt, and why.**
- The prompt measured a term against "the same desk's fourteen-day background". It is measured against everything
  else the archive holds for the window instead: a desk-only background proposes nothing on a new desk and can never
  find vocabulary the desk has used steadily but the lexicon never had (which is most of what her reports show).
- "Accounts whose posts recur in search results for the desk's terms" is not built: an unregistered account is never
  recorded (decision D1), so there is nothing to count. Accounts are proposed only from registered public actors'
  own posts and from her reports.
- The report miner sends the candidate and the number of reports that named it, never a sentence of a report.
- The page's copy of the lexicon (`AX_ISSUES`) and the Mac collector's offline fallback do not carry approved terms;
  rows are tagged by the worker, and the Mac reads the live lexicon before every sweep.

**Limits to know.** The term proposer is counting, not understanding: it will propose phrases that are distinctive
and useless (a reporter's turn of phrase, a place name in one story's coverage). That is what Preview and Dismiss are
for. Its thresholds (`DISC_MIN`, `DISC_LIFT`) are first values chosen on invented data; they should be tuned against
the first weeks of real proposals - how many were approved, how many dismissed.

Harnesses: `tests/den-discover-worker.mjs` (12), `tests/den-tools-test.py` (41).

**Not verifiable here.** No live archive was read, so nothing is known about the quality of the proposals on real
rows. The first real run is the test: `POST /den/discover {ns: 'aep', dry: true}` after deploy shows what it would
propose without filing anything.

## 6. Release 6 - Anne's Den (build `2026-11-11.studio-p58`, page `?v=r44`)

The page itself: **Anne's Den** in the Today group of the navigation. One desk at a time - a client, a region and a
report format. Five desks are seeded from what Phase 0 found: AEP national, AEP Victoria, Firearms, MCA national, MCA
Victoria. The two MCA desks use AEP's section list because MCA's reports could not be read (0.1); change it in Options.

**Today** sorts the reporting window's rows into the report's own sections - Key narratives, Traditional media
(syndicated copies folded into one row with the outlets that carried it, Facebook reach where held, a mark on
subscriber rows), Social (interactions, growth since yesterday's read, the tone of the comments held, the layer that
collected it), Influencer and political (registered organisations, officials and MPs on their own posts), and
Upcoming (a date written beside an action, not yet passed; never a guess). A row can be pinned to the report, set
aside with a reason, or opened at its source. After three set-asides of the same account, site or term the page
offers a mute, which a person confirms and can remove in Options.

**Nothing critical missed** sits above every tab. It is computed, with no model: Sentinel spikes, narratives that
became emerging, registered accounts and known actors seen for the first time in a fortnight, an issue running well
above its own baseline, a registered account's post drawing several times its usual, and - first in the list -
**any channel the desk relies on that delivered nothing in the window, with the reason**. An empty table must never
be read as a quiet day.

**Brief** is the report. One button drafts it from the evidence on Today, and says what it costs before it is pressed:
one model call, counted against twenty a day. The draft comes back checked against the rows it cites:

- a citation the evidence never gave is removed, and the sentence that rested on it is marked "No evidence behind";
- a figure that is not in the row it cites is flagged;
- a quotation from a subscriber outlet is cut at thirty words;
- a rating that is not one of the desk's own words is left blank for a person;
- the Source List is built from the rows the brief cites. A model never writes it.

These are checks on where a sentence came from, not on whether it is true or well judged: **the analyst's reading of
the draft is the quality control, and filing is her act.** A brief can also be written entirely by hand.

Editing: each section is a text box; what is typed is kept on the computer at once and saved on leaving the field (or
Ctrl/Cmd+S); a section a person has edited is never written over by a model unless she asks; if someone else saved
first, nothing is overwritten and the page asks Keep mine or Take theirs; unsaved words survive a reload. **Mark as
filed** first lists anything on the strip that the brief neither cites nor names, once. A filed brief is read-only
until reopened. History lists every save; Compare shows the words added and removed against the last filed brief.

**Getting it out** (decision D5): Copy for the document puts the brief on the clipboard with its headings and links, to
paste into the Google Doc; Download .md and .html; Copy the Slack summary. Writing to Google Docs is not built.

**Watch** is the register and the proposals of release 5: Preview, Approve under an issue, Dismiss with a reason.
**Collection** says, channel by channel, how it is read, whether a collector is connected, what it delivered for this
desk, and what cannot be reached; Collect now starts one job with its console; the signed-in platforms can be switched
off at once. **Options** are the desk's own: window, cadence, region, the sections and their order, the rating words,
the least interactions a post needs to show, mutes, table density, and the morning draft (off). A full key can add another desk for the same client there (a second region, or a second analyst's own desk).

**The measure of the work.** `python3 tools/den-backtest.py <folder of exported reports> --desk aep_au --key
$AXIOM_KEY --save` answers the question the whole project turns on: of the links her filed reports cite, what share
did AXIOM hold by the end of the day after each report, by channel and by layer, and which did it miss. It reads only;
`--save` keeps the summary for the Collection tab. **It has not been run: only the owner can run it, on the Mac, after
deploying, against real reports.**

**Differences from the prompt, and why.**
- The prompt's `posture` vocabulary is, in her reports, prose; the fixed words are the ratings (level and trend). The
  check is on the ratings.
- "Terms bursting against their own baseline" is measured per issue, not per term: the archive tags rows by issue.
- "Full text on demand" from a board row is not built: the row opens at its source, and subscriber text is read in
  the Sources view.
- The accessibility gate for the Den runs in its own harness (`tests/den-browser.mjs`, axe, three widths, both roles)
  rather than inside `tests/studio-a11y-browser.mjs`, which is built on the Studio's fixture.
- The scope bar does not drive the Den: a desk is the scope.
- Today's reads against each platform's cap are counted on the Mac and are not shown.

**Found by the tests and fixed before release** (each has its test): the board blanked on every pin; "Keep mine"
looped back into the same conflict; a draft could be started twice from another tab or by a second person (now one
draft at a time a desk a day); a brief started by hand was marked as edited; words typed in a second section while the first was still saving were dropped when the save returned; small labels and table headers failed
contrast (also the shell's "About this view" link, on every view); links were told apart by colour alone.

**Every route failing, one at a time** (`tests/den-inject-browser.mjs`, 60 cases): each of the page's eight reads was
made to fail, to answer with a gateway's page, to answer with the wrong shape, to hang and to drop; each of its ten
writes to fail and to drop. The first run found that a route answering 200 with the wrong shape made the strip say
"nothing found" and the desk list say "no desk is set up", and that two secondary reads failed silently. All are
fixed: a malformed answer is always said as a failure, with one press to try again, and nothing typed is lost.

Harnesses: `tests/den-worker.mjs` (20), `tests/den-browser.mjs` (27), `tests/den-inject-browser.mjs` (60),
`tests/den-tools-test.py` (63). Screenshots of each tab at 1366 x 768 and 1920 x 1080: `node --experimental-sqlite
tests/den-shots.mjs` (into the ignored `tests/shots/den/`); they were looked at.

**Not verifiable here.** No draft has been written by a real model: the stub writes from the evidence it is sent, so
the quality of a real draft - whether it reads like her reports - is unknown until the first one on the live worker
(one call). No live archive was read, so the board has only been seen on invented rows. Clipboard paste into a real
Google Doc was not tried (the clipboard holds HTML and plain text; what Docs makes of it is Docs').

### 6.9 The first live open (build `2026-11-11.studio-p61`, page `den.js?v=r48`)

On 11 November 2026, the day it was deployed, the page's first open on the live database answered "Today's evidence
could not be loaded. D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window."

What the page asked of the database on every open, before the fix:

| Read | Rows it walks | How often |
|---|---|---|
| The window's rows for the board | every row of the window, with its text | twice at once: the board, and the strip's own copy |
| An issue against its fourteen-day baseline | a fortnight of the archive | every open |
| Who is named for the first time | a fortnight of judged mentions | every open |
| The channels the desk relies on | a week of social rows | every open |
| A registered account's first post and its usual | a fortnight and a month of social rows | every open, once an account is registered |

In `arc_items` the tags (`meta`) are stored after the article text (`body`), so reading a row's tags walks its text
too: a scan over a fortnight is expensive in proportion to the full text held, which has grown since the full-text
work. At the same moment the Mac collector was claiming a run of topic jobs, each of which searches the whole
archive. Which of the two tipped it over is not known: no timing from the live database is available here.

What changed: one request on Today (`/den/board?missed=1`); the board's read narrowed in the database to the desk's
rows; the slow figures counted once in fifteen minutes for a desk and window and cached, with what is urgent read
every time; `503 db_busy` in words, retried twice by the page. Tests: DK18 to DK20 in `tests/den-worker.mjs`, two
cases in `tests/den-browser.mjs`; each failed before the change.

Still open, and for a person to decide: the archive has no index on `(kind, ts)` and keeps `meta` behind `body`. A
small table of tags by item (`item, issue, ts, kind`) written when a row is filed would let the board and every
baseline count read an index and never touch article text. It is the lasting fix and it is a change to how every
collector files a row, so it was not made in a hurry on the day of the fault.

## 7. Hand-over (11 November 2026)

### 7.1 What exists

| Release | Build | What it is |
|---|---|---|
| 1 | p53, page r40 | Her topics, outlets and actors in the lexicon, the source list and the entity register |
| 2 | p54, r41 | The watch register; one route every collector files through; official Facebook and Instagram routes behind a probe |
| 3 | p55, r42 | Signed-in collection on the Mac for Facebook, Instagram and YouTube search (switched on by nobody yet) |
| 4 | p56, r43 | Subscriber outlets through the agency's own subscription, once cleared; newsletters; monitoring exports |
| 5 | p57 | Keyword discovery: proposed with evidence, approved by a person |
| 6 | p58, r44 | Anne's Den: the page |
| 6.9 | p61, den.js r48 | The page's first live open overloaded the database: one read on Today, slow counts cached, a busy database said and retried |

### 7.2 The three layers, in one table

| Layer | What it is | Where it runs | Works today? |
|---|---|---|---|
| 1 Official | The platforms' own programmes: the Graph API, the Supermetrics public-data connectors | The worker; a Claude Code session for Supermetrics | **No.** The two Supermetrics sources are not on the licence; the Meta permissions are not granted |
| 2 Signed in | A person's own signed-in session on the agency's Mac: X and Reddit (existing), Facebook, Instagram, YouTube search, subscriber outlets | The Mac (`tools/reach-agent.py`) | X and Reddit as before. The rest: built, tested against stand-ins, **switched on by nobody** |
| 3 Keyless | Public routes that need no login: news feeds, X timelines, YouTube feeds, Bluesky, petitions | The worker | Yes, as before, now with her terms and actors |

The rules layer 2 keeps, in code: public content only; a person signs in by hand; a verification stops the sweep and
pauses the platform for a day; never a captcha solved, a proxy, a second account or a retry past a refusal; credentials
and sessions stay on the Mac; an unreadable answer is a named failure; no author is read. For news: only a subscription
the agency holds, only a source a person has cleared, never a paywall worked around.

### 7.3 The decisions, as taken (each is the prompt's default unless the owner changes it)

- **D1 Names.** A social row names only a register account marked as a public actor, on its own post. Done, in
  `signalsIngest()`. Commenters, repliers and unregistered accounts are never named, on any layer.
- **D2 Live Supermetrics reads.** Two of eight made, both refused by the licence (0.5). No client account data read.
- **D3 Layer 1 from the worker.** Built behind configuration that is absent; `/meta/status?probe=1` says what to set.
- **D4 Model spend.** A draft or one section written again is one call a person starts; `DEN_DAILY_CALLS` 20; the
  morning draft is off for every desk. Discovery, the strip, the board and Preview make no model call.
- **D5 Getting the report out.** Copy for the document, `.md`, `.html`, the Slack summary. No write to Google Docs.
- **D6 Who can use it.** Reading is read role; every write is full. Open access never reads a desk.
- **D7 Signed-in collection.** Every channel built, none switched on. **Automated reading with a signed-in account is
  against the terms of Facebook, Instagram, X and (for search) YouTube, and the account used can be challenged,
  restricted or closed. Never sign in with a profile that administers a client's ad account, Page or Business asset:
  a restriction on it would lock the agency out of client work.** The tool asks that question before a Facebook or
  Instagram sign-in and will not continue without an answer. Which platforms to switch on is the owner's decision,
  made per platform, and should be written into `CLAUDE.md` with who and when.
- **D8 Subscriber news.** Only through the agency's own subscription, only after a person records on the source what
  covers reading it for monitoring. Whether a subscription's terms or the agency's copyright licence do cover that is
  for that person to know: the software records the answer.
- **D9 Monitoring exports.** The importer is built; using it is the analyst's call.
- **D10 Only what is working (the owner, 12 November 2026, after this hand-over).** By default the Den shows the
  channels with rows for a desk and says nothing of the ones without; the reasons are inside Collection's one
  disclosure, and a desk's `showGaps` option brings everything back. Section 11.

### 7.4 The owner's steps, in order

**Deploy** (the worker ships from the laptop; the page from `main`):

```
git checkout main && git merge --ff-only claude/peaceful-gates-g1t4ss && git push origin main
tools/deploy-worker.sh
```

**Her key.** A roster entry of her own, full role (she drafts, approves and files): add `"<a key of her own>":
{"n":"Anne","r":"full"}` to the `AXIOM_KEYS` secret (`npx wrangler secret put AXIOM_KEYS --name newsaus`), and send
her the sign-in link privately: `docs/index.html#k=<her key>&v=den`.

**The first source sweep.** In Sources, filter to Untried and press Sweep on the 28 outlets added in release 1 (The
Point, National Tribune, the regional and sector outlets, the campaign sites, the official sources). Their addresses
are unverified until that sweep: a source that fails needs its address corrected in its drawer.

**Layer 1, when it can work** (not today):

```
# after "Facebook Public Data" and "Instagram Public Data" are added to the Supermetrics licence, in a Claude Code session:
python3 tools/den-pull-plan.py --ns aep --key $AXIOM_KEY          # prints the day's queries; run each with the connector, save the answers
python3 tools/supermetrics2signals.py out.json --ns aep --key $AXIOM_KEY fbposts=fbposts.json igposts=igposts.json ighash=ighash.json urlshares=urlshares.json --push
# or, for the worker's own route, once Meta grants the permissions (Business Discovery on the agency's Instagram business
# account; Instagram Public Content Access for hashtags; Page Public Content Access for other organisations' pages):
#   set the var META_IG_USER to the Instagram business account id, and META_PUBLIC_PAGES=1; then open /meta/status?probe=1
```

**Layer 2 on the Mac** (read D7 above first; start with YouTube, the lowest risk):

```
uv tool install https://github.com/Panniantong/Agent-Reach/releases/latest/download/agent-reach.zip && agent-reach setup
python3 tools/reach-agent.py --channels                  # what this Mac can collect now, and why not
python3 tools/reach-agent.py --login youtube             # then facebook, instagram: each shows the warning and asks the question
python3 tools/reach_social.py youtube --ns aep --key $AXIOM_KEY --dry-run --out /tmp/yt.json    # read it: an address, words and counts on every row
python3 tools/reach-agent.py --key $AXIOM_KEY --install-launchd                                  # keeps the collector connected
```

**After the first live run (s.3.1), in this order:**

```
git pull                                                  # the collector's fixes are in tools/
uv tool upgrade twitter-cli                               # may not fix X search: see s.3.1 D
uv pip list --python ~/.local/share/uv/tools/twitter-cli/bin/python | grep -i -E "twitter|xclient"   # which versions the Mac has
python3 -m pip install playwright && python3 -m playwright install chromium                           # for render and subscriber reads
python3 tools/reach-agent.py --channels                   # X: "usable" or "search is unavailable"; the three social channels: no_command
python3 tools/reach-agent.py --key $AXIOM_KEY             # after the worker is deployed (tools/deploy-worker.sh)
```

The `--login youtube|facebook|instagram` lines above cannot work with Agent Reach v1.5.0 (no such commands) and now
stop with that sentence.

**Subscriber outlets.** In Sources, open the outlet, choose how it is read, write what covers reading it for
monitoring, press Record. Then on the Mac:

```
pip install playwright && playwright install chromium
python3 tools/reach-agent.py --login news:afr --url https://www.afr.com/login      # a person signs in; one profile per publisher
```

**Her past reports** (a folder outside the repository):

```
python3 tools/den-mine-reports.py ~/Documents/briefs-aep --ns aep                              # what it would propose; nothing sent
python3 tools/den-mine-reports.py ~/Documents/briefs-aep --ns aep --key $AXIOM_KEY --apply      # proposals; she approves each in Watch
python3 tools/den-backtest.py ~/Documents/briefs-aep --desk aep_au --key $AXIOM_KEY --save      # the measure of the work
```

**The first draft.** In Anne's Den, on a desk with a day collected: Brief, Draft the brief (one model call). Read it
against her own report for the same day. That comparison is the acceptance test no harness can run.

### 7.5 Not verified here, and what verifies each

| Not verified | Why | What verifies it |
|---|---|---|
| The live archive: what the board, the strip and discovery show on real rows | The sandbox contacts no live worker | Open the Den after deploy; `POST /den/discover {ns:'aep', dry:true}` |
| A real draft: whether it reads like her reports | No paid model call is made here; the stub writes from the evidence | One draft on the live worker, read against her report |
| The 28 seed source addresses | No egress | The first sweep in Sources |
| The Meta permissions and limits (thirty hashtags a week, Business Discovery, Page Public Content Access) | Meta's documentation was unreachable from the sandbox; written as recalled | `/meta/status?probe=1` once a permission is granted |
| The Supermetrics public-data field ids | The licence refused both reads | `tools/den-pull-plan.py` and one real answer, once licensed |
| Every layer 2 channel against its live site, above all which fields carry the counts | No platform was contacted and nothing was signed in to; **and agent-reach v1.5.0 has no command for any of them (s.3.1 E)**, so there is nothing to run until a backend is chosen | The owner's decision on a backend; then `reach_social.py <channel> --dry-run --out` on the Mac |
| **Verified against real output (11 November 2026):** the shape of `agent-reach doctor` and `agent-reach --help` for v1.5.0 | The owner's paste, kept as fixtures | `tests/reach-channels-test.py`; a newer agent-reach needs a new paste |
| Whether `uv tool upgrade twitter-cli` repairs X search | Only the Mac can show it; the newest releases still carry the flaw | `python3 tools/reach-agent.py --channels` after the upgrade |
| The agent's stop-and-recheck for X on the real twitter-cli (the "Failed to init ClientTransaction" line on stderr of `twitter status`) | A stand-in answers in the tests | Run the agent: one line "not offering X" at the start, no X job claimed; `/bridge/status` shows `down: ["x"]` |
| The worker's side on the live queue: the X jobs already waiting are failed as `no_collector` within a tick | No live worker is contacted | After deploy, the Signals console or `GET /bridge/status` (queued falls) |
| MPs' own posts appearing under a topic from the timeline reader | The embed service was never reached from the sandbox | Topics, a keyword an MP has posted on, the X tab's note |
| Every subscriber read: the sign-in, the page shape, the wall detection | No publisher was contacted | `--login news:<id>`, then Read on one article and the job log |
| Recall against her reports | Her reports stay outside the repository and the worker is not contacted | `tools/den-backtest.py ... --save` |
| Pasting the copied brief into a real Google Doc | No Google Doc is written from here | Copy for the document, paste, look |
| Firefox and WebKit | Not installed in the sandbox (two cross-browser suites skip them, said as skipped) | CI, which installs them |

### 7.6 Asked for and not built, with the reason

- **TikTok, Threads, LinkedIn collection.** No usable route: no agent-reach channel for the first two, a jobs-only one
  for LinkedIn, and none of her 1,061 links goes to TikTok or Threads (five to LinkedIn). An account on them can be
  kept in the register as a note; it collects nothing, and the page says so.
- **Comment text on Facebook and Instagram.** No layer reaches it. Only interaction counts are held.
- **A Facebook page's own timeline** without Page Public Content Access. Only posts a keyword search finds.
- **Accounts that recur in search results** as proposals: an unregistered account is never recorded (D1).
- **Following the links inside a newsletter**, **full text on demand from a board row**, **today's reads against
  each platform's cap in the page**, **writing to Google Docs**, and **the scope bar driving the Den**: left out as
  small and separable; each is named where it would have been.
- **Re-tagging rows collected before a term was approved.** A term tags from its approval onwards.


## 8. Release 7 - public-record routes (build `2026-11-11.studio-p60`, page `den.js?v=r47`)

Keyless public routes that a research pass on 11 November 2026 found productive. No signed-in route was added and no
decision in 7.3 changed. The research report itself is client intelligence and is not in the repository.

### 8.1 What exists

| Route | What it is | Where |
|---|---|---|
| The public reader | `pubFetch()`: robots.txt obeyed (RFC 9309: this reader's group, else `*`; longest rule; Allow wins a tie), a user agent that says what it is (`AxiomPublicRecord/1.0`, or the var `PUBLIC_UA`), ten seconds between requests to one host, and a refusal (401, 403, 407, 429, a challenge page) recorded for the host in KV `pub_refused_<host>` and not asked again for a day. A sign-in page is `login_required`. No retry, no proxy, no challenge solved | worker |
| Source method `public` | A listing page read through the public reader: a headline and a link, never a body, paywall or not. A refused source's `last_error` says so and its `next_due` is a day away | Source Registry |
| The process calendar | Source method `process` and D1 `den_process`: a bill or inquiry page as one record (stage, referral, hearings, submissions closing, report date, number of submissions); a notice paper or disallowance list as one record a notice on a client issue. First sight and each stage change file one news row (`meta.process`); an unchanged page is a success that files nothing. `GET /den/process?ns=|desk=` (read), `POST /den/process/add {url, type, juris, house, title, issues}` (full) | worker |
| Upcoming | `denBoard` puts recorded dates first, marked `recorded`, with the parliament's page as the link; the page shows a "recorded" chip | worker, `docs/den.js` |
| Hansard | `hansardSweep()`: once a Sydney day a client, the first search term of each of its issues plus its approved terms (twelve at most) through OpenAustralia; kind `hansard`; the speaker named only when the MP register holds them. Needs the secret `OPENAUSTRALIA_KEY` | worker, `socialCron` |
| Petition counters | `petitionCountersSweep()` inside the daily petitions sweep: the count a campaign prints on its own page, stored with `meta.self_reported` and a daily snapshot; a count that cannot be found is `<host>_parse_failed` and files nothing. `GET/POST /social/petitions/counters {add:{url,name,ns} | remove}` | worker; Signals shows "self-reported by the campaign" |
| Sponsor on polls and estimates | `claimOf()` in `sourceRows`: `meta.claim {kind, sponsor, pollster, n}` by rules, "sponsor not stated" otherwise; the brief's evidence line carries it | worker |
| Registered actors on Bluesky | `bskyActorSweep()`: register accounts on Bluesky marked as public actors, their own posts (no reposts) through the public AppView, filed through `signalsIngest` as layer 3 so the name comes from the register. `canonPermalink` knows Bluesky (mirrored in `tools/den_permalink.py`) | worker, `socialCron` |
| Campaign names for the Ad Library | `POST /den/watch/seed` (full) proposes three campaign names as terms. Nothing is proposed unasked and nothing searches a proposal until a person approves it | worker |
| Seeds | 29 sources (release wire, court lists, Treasury's FOI log, NOPSEMA decisions, campaign and member pages of both sides, trade and community press), 7 watched parliament pages, 6 petition counters, 9 organisations in the entity register | worker |

`GET /den/collection` lists Parliamentary record, Hansard and Campaign petition counters with what each delivered;
`GET /social/coverage` lists Parliamentary record and Hansard. Harness: `tests/den-public-worker.mjs` (12).

### 8.2 Step 0 as it was done, and what it could not do

The prompt asked for `GET /sources` first. This session had no network route to the live worker and no key, so the
check was made against the seed list in the worker source instead. Already seeded, and so not added again: the
Parliamentary Budget Office, APO (a core feed), Australian Energy Producers (news), SSAA national, SIFA, Shooters Union, Sporting Shooter,
the Environmental Defenders Office, Beef Central, Gun Control Australia, the Alannah & Madeline Foundation. **What the
live registry shows (edited rows, failing addresses) was not seen**: read `/sources?status=unverified` after deploy.

### 8.3 Where this differs from the prompt

- **No archive kind `process`.** The record is the table; a stage change is a `news` row carrying `meta.process`, so it
  appears in the desk's media and the brief's evidence without a new kind in every reader.
- **One of the five pages named for seeding is not seeded**: the Tasmanian firearms bill. A second search found the
  parliament's list of 2026 bills (it is Bill No. 30 of 2026) but not the bill's own page. Add it in Anne's Den,
  Collection, once its address is known. Seeded since the follow-up: the ACT bill (its page on the ACT Legislation
  Register surfaced in search) and the Mount Pleasant Mine Bill (**its address is built from a bill id an aggregator
  reported; the page itself was not seen**, so expect it to need correcting).
- **"Once a sitting day" is once a Sydney day.** There is no sitting calendar in the worker; on a non-sitting day the
  sweep finds nothing new and files nothing.
- **Campaign names are proposed by a step a person presses**, not by the release itself: proposing them automatically
  gave three desks a register of their own accord, which changed when keyword discovery runs.
- **The stricter rules apply to the new routes only.** Sources that were already seeded keep their existing methods
  (`html`, `rss`, `gnews`) and the existing fetch. Moving one to the public reader is a change of its `urls.public`.
- **Adding a watched bill or a counter** is in Anne's Den, Collection (follow-up, `den.js?v=r47`): the watched pages
  with stage, next date and the last read or its failure in words, Watch this page, Stop (`POST /den/process/remove`:
  the source is switched off and its records leave the calendar); the desk's counters with Add and Remove; and
  Propose campaign names.
- **The ten-second pace** is kept in the isolate and, since the follow-up, shared through KV (`pub_next_<host>`, a
  minute). KV is eventually consistent, so two isolates asking one host in the same second could still both go; each
  source also runs on its own schedule (a watched parliament page every six hours), which is the wider spacing.

### 8.4 Not verified here, and what verifies each

| Not verified | Why | What verifies it |
|---|---|---|
| Every address in the new seeds | No egress; the addresses came from search results, none was opened | The first sweep: Sources, filter Untried, Sweep. A page that has moved fails in words on its source |
| The parsers against real pages (`processParse`, `processNotices`, `counterCount`) | The fixtures in `tests/fixtures/public/` are invented stand-ins shaped like such pages, because nothing could be saved from a real one | `GET /sources/probe?id=proc_gasres_inquiry`, then `GET /den/process?ns=aep`: the stage and dates against the page itself. Each counter: its number in Signals, Petitions, against the campaign's page |
| What each site's robots.txt allows this reader | Not read | The source's `last_error` after the first sweep (`robots.txt ... disallows this page`) |
| Hansard rows on real speeches | No key, no egress | Set `OPENAUSTRALIA_KEY`; `POST /social/sweep {platform:'hansard'}` and the job log |
| The Bluesky author feed's field names | The public AppView was not contacted | Add one organisation's Bluesky account as a public actor; `POST /social/sweep {platform:'blueskyaccounts'}` |
| The Ad Library on the campaign names | Needs `META_USER_TOKEN` and a person's approval of each term | `POST /den/watch/seed`, approve in Watch, `/meta/status?probe=1` |
| Recall against the filed reports, before and after | The reports are outside the repository and the worker was not contacted | `tools/den-backtest.py <folder> --desk aep_au --key --save` before deploy and a week after. **That number is the measure of this release, and it has not been taken** |
| The page in Firefox and WebKit | Not installed here | CI |

### 8.5 The owner's steps for this release

```
tools/deploy-worker.sh                                   # then the page from main
npx wrangler secret put OPENAUSTRALIA_KEY --name newsaus # free, openaustralia.org.au/api; Hansard stays off without it
# optional: a contact in the reader's user agent, e.g. "AxiomPublicRecord/1.0 (+https://<a page that says who runs it>)"
#   set the var PUBLIC_UA in the Cloudflare dashboard
```

Then: Sources, Untried, Sweep (the 29 sources and 7 parliament pages); `POST /den/watch/seed` and approve what is
wanted in Watch; add the three missing bills once their addresses are known.

## 9. A wider net (build `2026-11-11.studio-p62`; no page marker changed)

Asked for by the owner on 11 November 2026: collect more, from more places, on the clients' topics. Built under the
rules already in force and nothing else: public content, no sign-in, every new site through the public reader
(robots.txt obeyed, an honest user agent, ten seconds between requests to a host, a refusal not asked again for a
day), nobody named, and only rows on a client issue.

### 9.1 What exists

| What | How it is read | What is kept |
|---|---|---|
| Lexicon sweep, Google News (`lex_gnews`) | Each search term of the lexicon in turn, twelve a run, the last two days | A headline that carries a client issue, the outlet, the term that found it |
| Lexicon sweep, GDELT (`lex_gdelt`) | Three terms a run, Australian sources only | The same; a headline and a link, never a body |
| Lemmy (`lemmy_aussiezone`) | The instance's own posts, newest first | A post on an issue or from a politics community; then its comments |
| Hacker News (`hn_australia`) | Stories of the last three days on "australia" | A story that says Australia and carries an issue; then its comments |
| Forum feeds (`forum_ozpolitic`, `forum_propertychat`, `forum_bigfooty_pol`) | Each forum's own feed of threads | Threads (a general forum: only those on an issue). The feed gives no replies |
| Comments under news articles | A WordPress site's own comments interface, for sites already read that way | Comments under an article on a client issue, three hours after it appeared |
| 89 more outlets and organisations (`wn_*`) | Google News for the site, then its sitemap | Headlines, tagged like every other source |
| Reddit | 28 subreddits (15 more) | As before, on the Mac |
| Mastodon | Two more tags | As before |

A failing source now waits longer each time it fails (double, to a day at most), which is what makes room in a tick
for 96 more sources. The var `SOURCES_PER_TICK` raises the 50 a tick reads.

### 9.2 Not verified here, and what verifies each

| Not verified | Why | What verifies it |
|---|---|---|
| Every new address (89 sites, three forum feeds, the Lemmy instance) | No egress from the sandbox; the addresses are from memory of the sites, none was opened | Sources, filter Untried, Sweep. A wrong address fails in words on its own row and backs off |
| The three forum feed addresses in particular | Forum software moves its feeds; these are the usual addresses for each product | `GET /sources/probe?id=forum_ozpolitic` (and the other two). A feed that is not there: correct `urls.forum` in the drawer, or switch the source off |
| The answer shapes: Lemmy `post/list` and `comment/list`, the Hacker News search and item, GDELT's article list, WordPress comments | The fixtures in `tests/widenet-worker.mjs` are invented stand-ins written from each service's public documentation | The Probe on each source; the Signals tabs after one Sweep; a shape that differs fails as "no list of posts" and the like, never as an empty success |
| What each site's robots.txt allows this reader | Not read | The source's last error (`robots.txt ... disallows`) |
| Whether GDELT answers a Cloudflare address, and how often | Not contacted | `lex_gdelt` in Sources after a day: delivering, or refused and backed off |
| Which WordPress sites publish comments | Many close the interface or use another comment system | Signals, Web comments, after a day. An article whose site answers no list is marked and not asked again |
| How long a tick's sweep now takes | Cannot be timed here | `lastSweep.ms` on `GET /sources` (the Sources strip). Raise `SOURCES_PER_TICK` only if it is well under a minute |
| The database under more rows | The p61 overload was reasoned, not measured, and this release adds rows | Anne's Den opening without `db_busy` a week on. If it returns, the tags-by-item table (s.6.9) is the fix |

### 9.3 The owner's steps for this release

```
tools/deploy-worker.sh                    # then the page from main
```

Then, in the app: Sources, filter Untried, Sweep (the new rows); Signals, Lemmy, Sweep (one job reads every community
source and the comments). A day later: Sources, filter Failing and Dead, and switch off or correct what never
delivered. To add a forum, a Lemmy instance or a Hacker News word: Sources, Add source, tier Community.

### 9.4 Asked for and not built, with the reason

- **Forums without a feed, read page by page.** Each would need its own parser and many requests a thread; a feed is
  the forum's own statement of what may be read in bulk.
- **Disqus, Facebook-plugin and publisher-hosted comments.** No public keyless interface; reading them means driving
  a browser against a third party's widget.
- **More Reddit from the cloud, X search, Facebook and Instagram.** Unchanged: the Mac collector, as sections 3 to 3.3
  say.
- **Paywalled bodies.** Unchanged: headlines only unless a source is cleared (decision D8).

### 9.5 Published and not seen (12 November 2026)

The owner could not see the new Signals tabs after the merge. GitHub Pages had published the commit; the page loaded
`signals.js` and `sources.js` (and six other islands, and `axiom-ds.css`) with no release marker, so a browser that had
them kept the old copies. Each now carries `?v=r1` and the check in `tests/asset-versions.mjs` refuses a page script or
stylesheet without one. Until a browser has loaded the page once after this release, a hard refresh (Cmd+Shift+R) shows
the new files. The tabs come from the page alone; the Coverage rows, the Community tier in Sources and anything a Sweep
collects need the worker at build p62 (`tools/deploy-worker.sh`).

### 9.6 The collector's "HTTP 500" (12 November 2026; build `2026-11-12.studio-p63`)

The owner's Mac connected (offering Reddit, render, Facebook and YouTube search) and then printed "worker said HTTP
500; retrying in 15s". The worker had answered with a reason; the collector did not print it. It does now, with the id
to quote. A database that is too busy to answer says so (`503 db_busy`) on every route, and the collector waits a
minute on that answer. What actually failed on the live worker is not known here: the same poll answers correctly
against this build in the sandbox, so the cause is live state (most likely the database refusing the claim, as it
refused Anne's Den the day before). **The next line the collector prints is the evidence.** If it says the database
is busy most of the time, the tags-by-item table of s.6.9 is no longer optional.

## 10. The interface, redesigned (12 November 2026; built as pages `?v=r45` to `?v=r47`, merged with main as page `?v=r49` and build `studio-p64`)

**The decision.** The owner, of release 6's page: "The current UI looks primitive and boring ... a total UI upgrade to
look professional, production grade and reliable", and then, with a reference image of a light analytics dashboard:
"follow the following reference UI style ... and proceed with the build". For Anne's Den only, this overturns the
Phase 5 shell rules (flat panels, tables not cards, one hairline strip of figures, no elevation). What still holds:
semantic colour carries meaning only; numbers are tabular; every figure is a count of rows the page shows; a missing
count says why and is never drawn as zero; an empty table is never read as a quiet day. No other view was restyled.

**What was built (first pass).**
- While the Den is the open view the whole page is light: `docs/den.css` re-declares the app's tokens on
  `body:has(#v-den.on)`. Leaving the Den restores the dark shell. The scope bar is hidden there (a desk is the scope).
- The frame: a side menu (desk card, the five areas as a vertical tablist with icons, the model-call meter) beside one
  white workspace card. The desk select, the chips, Refresh and `?` sit at the right of the header.
- Today opens with `Overview` (`docs/den.js`): five figure tiles that jump to their tables, a stacked bar chart of
  the window by channel (twelve steps, legend, tooltip on hover and focus, each column labelled in words for a screen
  reader), and three cards - by channel, most carried stories, tone under the posts. All of it is counted in the
  browser from `GET /den/board`; no route and no model call were added.
- Chart colours are tokens `--den-s1..7` in a fixed order (news, X, Facebook, Instagram, YouTube, Reddit, Bluesky;
  anything else is grey "Other channels"), checked for colour-vision separation on white.
- Tables, chips, buttons, the strip, the brief's editors, notices and dialogs were restyled on the same markup.

**Proved here.** `tests/den-browser.mjs` 24 (axe at 1366, 1440 and 1920, full and read-only keys),
`tests/den-inject-browser.mjs` 60, `tests/den-worker.mjs` 17, `tests/studio-tokens-test.mjs` 4, `node tests/run.mjs
check` 26. No test was changed. Screenshots of every tab were retaken with `tests/den-shots.mjs` and looked at.

**Second pass (page `?v=r46`, worker unchanged).**
- **A dark theme**, this person's choice (Light / Dark under the side menu, localStorage `ax_den_theme`, stamped on
  `#den-root[data-theme]` before the island draws). Dark leaves the app's own tokens alone and gives the Den dark
  steps of its tokens, chart colours included.
- **Cards or a table** for stories, posts and public actors on Today (the switch above the sections, localStorage
  `ax_den_view`; the table is the default). A card shows what its table row shows and nothing more, carries the same
  Pin / Set aside / Open, and answers the same keys (the handler reads `.den-row`, which both carry).
- **Collection at a glance**: one tile a channel above the table - the last day's count, the state in words
  (delivering / nothing in the last day / switched off / paused at a verification) and seven days. The tiles hold no
  buttons; Collect now stays in the table.
- Skeleton bars while a panel loads (the "Loading ..." sentence stays, for a screen reader and a slow line); a
  citation chip in the brief says what it cites on hover and on keyboard focus; the brief's sections sit in a
  readable measure; a proposal's score has a meter.
- `tests/den-browser.mjs` is 29: five new cases (the figures equal the tables and the chart adds up; a desk with
  nothing collected draws no chart and no zero; cards and table hold the same rows, keys and actions, and pass axe;
  the dark theme survives a reload and passes axe on all five tabs; the menu by keyboard, the channel tiles, and no
  sideways scroll at 1024). No earlier case was changed.

**Third pass (page `?v=r47`, `ax-ui.js?v=r5`, worker build `2026-11-12.studio-p59` on the branch; `studio-p64` once merged with main).**
- **Sheets beside the page** (`Sheet` in `docs/den.js`): never a modal. From 1280 px the workspace gives an open
  sheet its room, so no action is covered; below that the sheet lies over the page and Close or Escape puts it away.
  The brief's History and Compare open in sheets (the same panels inside), and "Show beside the page" under a
  section opens **the evidence**: every row the draft was given, by its mark, the cited one first in view, each
  with its source link. A citation chip still opens its source directly.
- **Ratings are one press**: each rating and its trend is a radio group of the desk's own words (press the chosen
  word again to leave it unrated). The save path is unchanged.
- **The desk menu**: the card at the top of the side menu is a button that opens the desks (`role="menu"`,
  `menuitemradio`; Escape or a click outside closes it). The native select in the header is gone.
- **Collection**: each tile carries seven days as bars. `GET /den/collection` gained `delivered.days` (seven counts,
  oldest first, that add up to `d7`) - additive, no other field changed. The job console is docked under the
  workspace (state held by the shell), so it stays while the areas change; Hide the console puts it away, and a job
  that finishes later does not bring a hidden console back. The console keeps its own dark ground in both themes
  (in the light theme it had been dark-theme ink on a grey box, which the new axe case found), and its log can be
  reached and scrolled by keyboard (`docs/ax-ui.js`: `tabIndex`, `role="log"`).
- **Watch**: proposals are drawn as review cards (the same table rows, so the same actions and tests), and Preview
  shows what a term would add as bars by channel above its sample.
- **Options**: an index of its sections that moves focus into the one chosen, switches in place of tick boxes, and
  the Save bar stays in view at the foot. Section order is by the Up and Down buttons, which a keyboard reaches.
- **The styleguide** has a Den section with the components in both themes.
- Tests: `tests/den-browser.mjs` is 31 (two new cases: the evidence sheet, ratings and Escape; the desk menu by
  keyboard, the docked console across areas, and axe on Watch, Options and Collection). `tests/den-worker.mjs` DK15
  also holds the seven-day series. **Tests changed because the markup did** (each only in how it finds the control):
  choosing a desk (`desk(page, id)` in the fixture, in place of `selectOption` on the header select - three places,
  the list of desks, the chosen desk, and two "the header survives" checks) and reading a rating (the checked radio
  in place of a select's value). No assertion was weakened.

**Decided against, and why.** The brief's editors stay text boxes: the working copy, save on leaving a field, the
conflict flow and the sixty failure cases all rest on them, and a rich editor that could not promise the same was
not worth an analyst's lost words; so citation ids stay typed marks in the text. Preview stays inside its proposal
(it reads beside the reason it was proposed) rather than in a sheet. The export actions stay four visible buttons
under "Get it out" rather than a menu: each is one press. Section order has no drag handle: Up and Down do it.

**Not verifiable here.** The page was seen only on the fixture's invented rows. `:has()` carries the theme switch:
it needs a browser from 2023 or later (Chrome 105, Safari 15.4, Firefox 121); an older one shows the Den's cards
light inside the dark shell.

## 11. The guided run, and only what is working (12 November 2026; worker build `2026-11-12.studio-p65`, pages `den.js?v=r50` to `?v=r55`, `den.css?v=r53`)

**The decision (D10).** The owner was shown three directions for the flow of the page (`prompts/annes-den-flow.md`:
a guided run, a command desk, a briefing document) and chose the first, with one condition. The owner's words, in
full: "A guided run but do not show facebook and instagram not working or not connected.. just show only the stuff
that it working". This is recorded as **D10**. A note on the number: the design notes and the first draft of the plan
called it D9, but D9 was already taken (monitoring exports, 0.7 and 7.3), so it is D10 in this file, in `CLAUDE.md`
and in every code comment.

**What it means, as built.** A desk has one more option, `showGaps` (`options.showGaps`, a strict boolean, `false`
for every desk and for a new one; no migration). Off, the Den shows the channels that have rows for the desk and says
nothing of the ones that do not: no "delivered nothing", no "not granted", no "no collector", no chip, tile or title
that explains an absent figure. On, every string and layout is as sections 6 and 10 describe. The switch is in
Options, "Channels on screen": "Also show the channels with no rows". Saving it reads the strip and the board again
at once.

**What is hidden by default, and where each is still reachable.** Everything in the right-hand column is one press
away for a person who is setting a channel up; nothing was deleted.

| Hidden while `showGaps` is off | Where it is now |
|---|---|
| The strip's sixth check: a channel the desk relies on that delivered nothing, with why. The worker does not run it (`checks: 5`); the strip's empty state reads "None of the five checks found anything ..." and never "every channel this desk relies on delivered" | Options, the switch (the sixth check, gaps first, the folded "N not collected" mark) |
| Today: "See what was collected, and why not" (now "Open Collection"); "no counts are held for these posts", "no counts held", "no Facebook reach held" and the titles that explained a "-"; "Nothing on this desk was collected ... not the same as a quiet day"; "No channel delivered a row"; "Comment text on Facebook and Instagram is collected by no layer"; the Facebook column and figure when no story on the board carries the figure | Options, the switch |
| Watch: a registered account's `last_error` and "not yet" (now "-"); "No collector reads TikTok ..." (now "An account on TikTok is kept as a note.") | Collection, the disclosure, "To finish setting up" (each account or hashtag that failed or has not read, with its reason and a link to Watch) |
| Collection: the tiles and rows of channels with no rows in seven days, switched off, or paused at a verification; "nothing in the last day", "switched off", "paused at a verification"; "Cannot reach: ..."; the "No Mac collector is connected" sentence; the Signed-in collection panel; a watched page's "failed", "not read yet" and "switched off" chips; the sentences on what is not built | Collection, the one disclosure **"Add or switch on a channel"** (`details#den-more`, closed by default): "Channels to add" (what switches each on first, then how it is read, what it cannot reach, its state now), the collector sentence, "Signed-in collection" exactly as before, "To finish setting up", "Recall, by channel", the not-built sentences |
| Recall against the reports: a channel that held none of the links, and the list of misses | The disclosure, "Recall, by channel". The total line and the channels that held a link stay on the page |
| The draft: the rule that a brief must say which channels were not read, the "SAY PLAINLY" lines and the empty group headers in the evidence, "no counts held" on a post, the old `no_evidence` sentence (`denSys`, `denEvidence`, `denBriefDraft`) | Options, the switch: on, a draft is written as before and the filing check lists the gap |
| The view's note in `docs/index.html`: "Collection says which channels read, and why not" (now "Collection shows the channels delivering for this desk and where to add one") | - |

**What is never hidden.**
- The answer to something a person just did: a refused save, a failed keep, a job that could not run, "Stopped. It is
  listed under Add or switch on a channel." D10 hides standing statements, not results.
- The kill switch. Every listed channel that is read through a signed-in session (X, Facebook, Instagram, YouTube,
  Reddit) has **Switch off** beside Collect now, on the default page. Off, the channel leaves the list and is
  switched on again inside the disclosure; the press is answered ("Switched off. X is listed under Add or switch on
  a channel.") and the focus goes to the disclosure. That switch only ever adds to the off list. While a subscriber
  outlet is cleared, the Subscriber outlets panel has **Switch off subscriber news** for the same reason.
- What is there. A new line under Today's toolbar, in all three views and whatever the option: "In this window: News
  8 X 2" (`div.den-cover`, from the board's own `byChannel`, largest first, not drawn when the window is empty).
- A narrative whose stance has not been judged still shows "not read yet": that is about a judgment, not a channel.
  A poll with no sponsor still says "sponsor not stated": that is about a source.

**Which earlier rules it overrides by default.** Two rules of section 10's "What still holds" ("a missing count says
why", and "an empty table is never read as a quiet day" as far as that was said by naming what was not collected)
and section 6's "gaps lead the list". With `showGaps` on they hold again exactly as written, in Guided too: the
strip is then drawn whole above the card, gaps first, each with its reason and "Open Collection", and Collection has
no disclosure. What an empty desk says by default is neutral and true: "Nothing to decide yet. No story or post on
this desk's issues is in this window. A brief can still be written by hand." It does not say the day was quiet.

**Text written before the decision is not rewritten.** A draft or a filed brief from before build p65 keeps any "was
not read" sentence it has. "Draft again" brings today's draft into line; a filed brief is a record and stays.

**Definitions (one place decides each).**
- **Decidable row**: one entry of the board's `media`, `social` or `actors` as listed (after folding, after the
  150 / 90 / 60 caps). Narratives and Upcoming are not counted.
- **Decided**: kept (pinned) or set aside. "Decide later" is not a decision.
- **Progress**, counted once in the worker (`denBoard`, `progress {total, kept, aside, left}`): `kept` is the pinned
  entries of the three lists, `left` the entries not pinned, `aside` the set-aside decisions in row units (a post
  counts one; news counts one per fold key, and only when no live story still has that key), `total` their sum.
- **Listed channel** (Collection's default tiles and table): `delivered.d7 > 0` for this desk and its signed-in
  collector neither switched off nor paused at a verification (`denChWorking`, sent as `working`). A channel whose
  Mac is simply not connected now stays listed, so it does not leave and return each night; nothing on a listed
  channel says "delivering" unless it delivered in the last day, otherwise it shows its seven-day count.
- **In this window** (the coverage line): channels with at least one row on the board.

**The guided run.** A fresh profile opens Today in **Guided** (`ax_den_view`: `table` and `cards` are kept once
chosen; anything else is Guided). The flow prompt drew four steps beginning with "Check coverage"; that step is
what D10 hides, so the run has three.
- **The rail** (`nav.den-rail`, "Today's run", above the strip, outside the tabs): Triage ("4 of 9 decided", ", N for
  later", "done: K kept, A set aside", "nothing to decide"), Write ("not started", "draft", "edited", ", N kept rows
  not in it"), File ("nothing to file yet" under 200 characters, "not filed", "filed by NAME, TIME"). A step opens
  its area and never spends. Its figures come from `run` on the strip's answer, so they are there on every tab and
  for the desk they were counted for.
- **The header's one action** (`#den-next`): one step on from where the person is ("Next: write the brief, N not
  decided", "Next: read the draft", "Next: file the brief", "Back to triage, N left", "Next: triage, N left", "Filed
  today"; "Open the brief" for a read-only key). It opens an area; it never starts a draft.
- **The card** (`#den-focus`): one row with what is held about it and nothing about what is not, then Keep for the
  report, Set aside, Another reason (duplicate, foreign, old news, other), Open the source, Decide later, and
  "Leave the other N for later". One decision is one request; a failed one changes nothing and is said. Undo is
  offered for the last decision. A read-only key gets the card, its source and "Next row", and sends no write.
- **The queue**: rows a signal is about first (an outlier post, a first-seen account's post), then rows tied to a
  signal by issue or name, then the rest; inside each by reach, outlets and time. Rows left for later go last
  (`ax_den_later_<desk>_<day>`, this computer only, never sent). "Up next" lists eight and any can be brought forward.
- **The tray**: kept rows under the desk's own section titles, each with Take out, and the strip's signals with
  whether a kept row carries each. Once today's brief exists the tray follows it: a kept row reads "in the brief" or
  "not in the brief" (by the brief's citations), and each signal reads "In the brief" or "Not in the brief yet" by
  the worker's own filing check (`run.brief.open`), so the tray and the filing dialog cannot disagree.
- **Done states**: every row decided, an empty window, or only rows left for later; each has one button that opens
  the brief and spends nothing.
- **Keys**, from the card only: P keep, X set aside, O or Enter open the source, J decide later; K brings back the
  row last left and U undoes, anywhere in Guided. One key typed during a decision is held for the next card. A key
  held down counts once: its repeats decide nothing.
- **The mute offer** is a status line under the card, never an alert: "Mute it on this desk" or "Not now", and Not
  now is remembered (`ax_den_offer_no_<desk>`).
- **Two deliberate changes, in Guided only.** X sets a row aside in one press, as "not relevant" (the table still
  asks for the reason first). Setting aside a folded story is one decision for every copy, in one request:
  `copies: [ids]` on `POST /den/aside` (and on a clear through either route), so a story is never half set aside
  and counts once toward the mute offer.
- Table and Cards are as section 10 left them, with the rail and the coverage line added.

**Write and File.** The brief is steps 2 and 3. The two bars at its foot are one region, `#den-file` ("File the
brief"), under a line that says where it stands ("4 of 10 sections written. 1 sentence without evidence. 2 kept rows
not in it. Unsaved changes."). The rail's third step, the header's "Next: file the brief" and
`AXUI.goto('den', {tab: 'brief', step: 'file'})` put the focus on Mark as filed when today's brief holds 200
characters or more, and move nothing otherwise. `GET /den/brief` answers the latest brief of any day, so an older one
is said to be older (`#den-older`: "This is the brief for DAY. Today's has not been started.", with Draft the brief
and Write it by hand); the File step lands on that notice, never on an older brief's Mark as filed.

**The worker (build p65), all additive.** `showGaps` on a desk; on `/den/missed` and `/den/board?missed=1`:
`checks` (5 or 6), `issue` on a spike, `issues` on an emerging narrative, and `run {day, progress, brief {id, day,
status, revision, edited, written, cited, open, filed_by, filed_at}}` (`null` for a past window); `progress` on
`/den/board`; `copies` on `/den/aside` and `/den/pin`; `working`, `howOn` and `setup` on each channel of
`/den/collection`. The slow figure behind the sixth check is still counted and cached whatever the option, so
switching it on reads from the cache. No route was removed and no field changed its meaning.

**Release order.** Publish the page before or with worker p65, never after it: page r49 on worker p65 would say six
checks ran and every channel delivered.

**Proved here.** `tests/den-worker.mjs` 24 (DK21 the option, DK22 what follows it, DK23 `run`, DK24 `copies`; DK6,
DK12, DK15 and DK19 changed to assert the default first and the gap with the option on), `tests/den-public-worker.mjs`
12 unchanged, `tests/den-browser.mjs` 68, `tests/den-inject-browser.mjs` 81, `tests/studio-tokens-test.mjs` 4, `node
tests/run.mjs check` 27 (it now parses `den.js`). In the browser harness the main journey turns `showGaps` on,
because it asserts gaps; eighteen cases are the guided run on fresh profiles; fifteen are D10 with the option as it
ships. One of those reads every tab of a desk with rows and of an empty desk, in Guided, Table and Cards, and fails
if the text that is drawn, or the title or label of anything drawn, matches
`delivered nothing|not collected|not granted|not connected|No Mac collector|no collector|switched off|paused|not
read|Cannot reach|refuses|collected by no layer|no Facebook reach|why not|nothing in the last day|no counts|was
collected|not the same as a quiet day`; the Collection case proves the check can see, by reading the opened
disclosure with it.
The last is three whole-page gates on the default screen: a read-only key has no control that writes on any tab or
inside the opened disclosure and sends no write; every control is named and nothing overflows; axe finds nothing
serious or critical at 1366, 1440 and 1920 for a full and a read-only key, with Collection opened and Options also in
dark. **Tests changed because the page did**: the cases that assert gaps turn the option on first; "every channel at
a glance" became "every delivering channel"; Collect now for Bluesky and the switches are pressed inside the
disclosure; the tray's mark for an uncited kept row is read as "not in the brief". No assertion was weakened.
`tests/den-shots.mjs` now shoots the default screen (Guided with the card, in dark, and with triage done; the table;
Brief with the File region; Watch; Collection closed and opened; Options with the switch) at 1366 x 768 and 1920 x
1080, and every picture was looked at. The same screens with the option on are `01-today-gaps-on` and
`02-collection-gaps-on` from the browser harness run with `SHOT=1`.

**Where this differs from the plan, and why.**
- A kept row the brief does not cite reads **"not in the brief"**, not "kept after the draft" (page `den.js?v=r53`).
  The page knows what the brief cites; it does not know when a row was kept, and a draft is not bound to cite every
  kept row, so the first wording was false for a row kept before a draft that left it out.
- "To finish setting up" lists registered accounts, hashtags and watched pages. It lists no campaign counter:
  `GET /social/petitions/counters` says nothing of a single counter's read, and the worker was not changed for it.
- Parliamentary record, Hansard and the counters have no Collect now while the option is off: they have no collection
  job, and the button could only answer `unknown_channel`.

**One open point for the owner.** The disclosure's name is fixed by the decision as "Add or switch on a channel". A
channel that is switched on and has no rows for the desk is therefore switched *off* from inside a disclosure whose
name says "on". The kill switch for everything on screen is on the default page, so nothing listed is ever more than
one press from off; if the name should also say "off", it is one string.

**Left as it is, and worth a look.** Two standing phrases are not about a channel and were not in the decision's
list, so they stay: a spike's "Not yet acknowledged" and a narrative's "not read yet". (The Interactions tile's "no
read from yesterday to compare" was a third; since r54 it is drawn only with the option on, like the same words in
the Social table.) Subscriber outlets ("headlines only") and the job console are unchanged.

**After review (page `den.js?v=r54`, `den.css?v=r53`; no worker change).** What a review of the change found, each
checked against the code and fixed with a test that fails without it:
- *A reload made for the last desk landed on this one.* A decision in Guided still in flight when the desk was
  changed armed its timer after the card had gone, and the read it started was the last desk's: the board then
  drew "Loading today's evidence" for good and the strip showed the other desk's signals. `useLoad` now refuses a
  loader made for another key (which also closes the same path from a table row's Pin and "Put it back"), and
  Guided touches nothing after it is left.
- *The rail.* Today opened after the desk was changed on another tab was handed the last desk's strip, and the rail
  fell to "reading": the hand-over ends when Today is left and on a change of desk, and an answer for a desk that
  is not shown is not taken. A strip read that failed left "reading" for good: it now reports the failure and the
  steps show no state. The focus asked for by "Next: triage" ends with the visit it was asked on. `aria-current`
  goes to File only when the focus was moved there, and back to Write when the person goes into a section.
- *Guided.* A key held down decides one row (`e.repeat`). A decision that fails just after one that was saved no
  longer cancels the read that confirms the saved one, and is said on the status line as well as in the toast
  ("Not saved: ..."). A read that takes the row off the card hands the focus to the card that takes its place when
  the old one had it. The card names its signal in words ("Signal: TITLE"); an "Up next" button is named by what it
  shows (where it is from, the headline, "left for later" or "signal"). The two status lines (`.den-last`, and
  `.den-say`, which holds the mute offer) are in the page before they have anything to say. The compact strip says
  the signals are "listed with the card", which is true under 1100 px too. Yesterday's rows left for later are not
  carried into today when the day turns with the page open.
- *The focus at the hand-off.* The done state's button and the header's action leave the page when Brief opens:
  the focus then goes to `#den-tabpanel` (never when the page opens, never when something still holds it). "Write
  it by hand" and "Draft the brief" on an older brief's notice hand the focus to the new brief's first section.
- *Collection.* On a worker older than p65 the page applies the worker's own test (delivered in seven days, not off,
  not paused), so a channel that is off is never listed with a button named "Switch off" that would have switched
  it on. A listed channel whose signed-in read no collector offers now is said inside the disclosure ("Listed
  above, and where each stands now"). A registered public Facebook group that has not read is listed under "To
  finish setting up".
- *Tests that could not fail.* DK24's cut at forty now puts held copies behind the cut and holds the database to
  100 variables; a post titled with a story's headline proves both kind guards. The D10 case draws an actor's post
  with no counts and a narrative with no stance (that chip, and only it, is taken out before the phrase list is
  applied). The dark axe pass is of the screen with gaps drawn again, and Cards are drawn and checked with the
  option on. The whole-page gate waits for the disclosure's own read of this visit, and checks names and overflow on
  every tab at all three widths. The inject harness fails the register read that the disclosure makes.

**After a second review (page `den.js?v=r55`; no worker change).** Two more, each real in the code:
- *The one-way switch could still switch a platform on.* `POST /den/reach` replaces the whole off list, and the
  listed "Switch off" built the list it sent from the page's own copy, which is as old as its last read of
  Collection. A second press before that read came back (X, then subscriber news) sent a list without the first
  source, and one press on a page that had not seen a colleague's switch dropped the colleague's. Every switch,
  the listed one and the one inside the disclosure, now reads the list in force (`GET /den/reach`) just before it
  sends one and changes its own source only; the worker's answer is drawn at once, so what was switched off leaves
  the list before Collection is read again. Two cases hold every later read of Collection and press: two listed
  switches back to back, and each kind of switch after the list changed on the worker. (Between that read and
  the write there is still a moment in which two people pressing at once can lose one press: the route takes a
  whole list, and closing that needs a worker route that adds or removes one source.)
- *A test that could not fail.* The inject harness took any row of "To finish setting up" as the healthy page of
  the register read the disclosure makes. The world's never-read parliament page is a row there whether or not the
  register answers, so "slow" passed 1.2 seconds before the answer and "recovers" passed without one. The healthy
  page is now the registered account's own row, which only the register's answer can draw.

**Not verifiable here.** Everything was seen on the fixture's invented rows with a stub model: no real draft was
written under the new rule for the model ("write about what the evidence holds"), so what a real draft says about a
thin window is unread. The live `/den/collection` was not seen: which channels are "listed" on the real desks
depends on what each delivered in seven days.
