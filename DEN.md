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
morning draft off (amended 16 November 2026, the owner: narrative naming is automatic within `NARRATIVE_DAILY_CALLS`
and every narrative has a computed working title; a draft is still one call a person starts, s.10.5); D5 copy as rich text, `.md`, `.html`, Slack summary; D6 read role reads, full role drafts and
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
be read as a quiet day. *(Superseded on the page by s.10.2, 16 November 2026: gaps are said on the Collection tab
only; the rail has five checks.)*

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

### 6.10 The Storyboard (13 November 2026; page `den.css?v=r46`, `den.js?v=r49`; no worker change)

The page was redesigned from the audit in `prompts/annes-den-ui-variations.md`; the owner chose concept A of the four
prototypes in `design/prototypes/annes-den-concepts/`. What a person now meets:

| Where | Before | Now |
|---|---|---|
| The window | The app's masthead, navigation and scope bar above the Den; the first row 600px down at 1366 x 768 | A focused window (`body.in-den`): a 48px top bar with Back to AXIOM and a 44px rail; the first card is on the first screen |
| What must not be missed | A list repeated above every tab | Six pills on the rail, gaps first; a pill opens its findings, whether the brief covers each, and its one action. A gap is also said on the Board ("Not a quiet day"). *Superseded by s.10.2: five checks, gaps on Collection only* |
| The evidence | Five stacked tables on Today | The **Board**: cards by weight in Unsorted, and a column for each section of the desk's report. A card is filed by drag, by the section's number, or by its select |
| The brief | Nine to eleven textareas in one column, citations as bare ids | One section open between an outline and the evidence filed under it; "As it reads" with citations as outlet chips and each flag at its sentence; a card inserts its citation at the cursor; a sticky foot bar. *Superseded by s.10.3: one section page, read by default, edited in place; cards headed in words* |

Decisions that bind:
- **Filing pins.** Filing a row under a section sends `POST /den/pin` as the Pin button does, so a draft must cover
  it. Narratives and dates are not rows the worker pins: they are filed on the computer only.
- **Where a card sits is this browser's note**: localStorage `ax_den_file_<desk>_<Sydney day>`. The worker was not
  changed, so a second person, or the same person on another computer, sees the pins and not the columns. Moving
  this to the worker (a `section` on `den_marks`) is the obvious next step and was not built.
- **A weight is the page's arithmetic**, from the figures `GET /den/board` already returns (`weigh()` in
  `docs/den.js`), shown with its reasons. It orders cards; it hides nothing but old, low-reach posts (Low weight, one
  press away).
- **Covered / not covered** uses the rule `denBriefFile` applies (a cited row the check names, its words, or a plain
  statement that a channel was not read), on the words in the editor.
- **Only an id the brief's evidence holds can be cited from a card**, because `denCleanText` removes any other on
  save. A row collected after the draft says so and offers nothing.
- The Board still reads the window once (`/den/board?missed=1`). The brief (`GET /den/brief`, one row) is read when the
  Den opens, not on the first visit to Brief.

Not verified: the live worker and real rows. Weights, column widths and the rail at a desk with many findings were
seen only on the fixture's invented day (`tests/den-shots.mjs` saves both sizes into `tests/shots/den/`; the earlier
layout is in `tests/shots/den-before/`).

### 6.11 Where a card is filed is the desk's (15 November 2026; build `2026-11-15.studio-p66`, page `den.js?v=r50`)

The step s.6.10 named and did not take. Until now which column a card sat in was one browser's note, so a second
person, or the same person on another computer, saw the pins and an Unsorted queue. Now:

- **`den_marks` has a `section`** (added by `ensureDesks` with `ALTER TABLE`, once, on the first open after the
  deploy). `POST /den/pin {desk, item, section}` files the row under that section as it pins it; `section: ''` takes it
  back to Unsorted and leaves it pinned; a pin that says nothing about the section (the Pin button) keeps the one it
  has, so pinning never unfiles. A section id the desk's report does not have, or the Source List, is refused
  (`400 unknown_section`) and nothing is written. A set-aside unfiles the row; clearing a mark removes both.
- **`GET /den/board` carries `section` on every media, social and actor row** (`''` when unfiled). A folded story
  shows the section of whichever copy was filed.
- **The page adopts the board's answer.** When the board arrives, what it says replaces this computer's note for
  every row it names (`adopt()` in `DenApp`; a section hidden on Options counts as Unsorted), so a filing made by
  someone else, or on another computer, shows here. The Den opened on another tab than the Board (the last tab used
  is kept) now reads the window once too (`GET /den/board?desk=`, no checks), so the Brief's evidence is the desk's
  record from the first screen and an Unfile there reaches the worker; the Board's own read, when it opens, carries
  the checks as before. This computer's note (`ax_den_file_<desk>_<day>`) mirrors the worker and stands on its own
  only for narratives and dates, which the worker does not pin, or under a worker older than this page, which says
  nothing about sections. Filing from the Board (drag, number, select) and from the Brief ("File here", "Unfile")
  sends the section with the pin, and the Board reads the window again after each write, so a read in flight when the
  pin went out cannot bring the old column back.
- **Notes made before p66.** The first board with sections a desk has seen on this computer (`ax_den_sec_sent_<desk>`)
  sends each note it holds for a pinned row the worker reports under no section, once, instead of dropping it; after
  that a pinned row under no section is someone's "back to Unsorted" and the note follows it.
- **Cost:** a filing is one `POST /den/pin` and one read of the window; moving a row that is already pinned is now a
  write and a read where it was none. The Board still opens on one read of the window.
- Harnesses: `tests/den-worker.mjs` DK21 (the pin carries the section, the board returns it, a folded copy, a refused
  section, a pin that says nothing keeps it, a set-aside unfiles it, clearing removes it, a read key, the sister desk
  sees the same story unpinned and unfiled); `tests/den-browser.mjs` (the filing case checks the worker's answer and
  opens a second browser with no note, as another person; a new case opens on the Brief tab on another computer and
  finds the filed card as the section's evidence, and its Unfile reaches the worker); 33, 60, 21 and the five token
  checks pass. The change was reviewed by three readers and each finding verified against the code before the commit:
  the `ALTER` swallowed every error (now only "duplicate column"), an Unfile from the Brief without the Board read
  stayed local, a stale board read could undo a fresh move, two quick clicks on the Brief lost one, a hidden section
  was adopted, and two of DK21's assertions could not fail.

Deployed by the owner on 15 November 2026 at 11:49 UTC, after the branch was merged to `main` (c057ef9) and GitHub Pages
served `den.js?v=r50`: the live worker answers build `2026-11-15.studio-p66`, revision c057ef9, deploy token
`6709076c463c0290`, and `/engine/status` answered 200 after the upload. Not verified: the `ALTER TABLE` on the live
`den_marks` (it runs on the first `/den/` request with a key, which is the owner's), and the write and read a move now
costs under a busy database.

### 6.12 The four items s.6.10 left, and the quiet desk (15 November 2026; page `den.css?v=r47`, `den.js?v=r51`; no worker change)

Page only: every route it uses already existed. Branch `claude/den-storyboard-next`, cut from `main` after s.6.11 was
merged and the owner deployed p66.

- **Bulk set-aside on the Board.** Every Unsorted card the worker can set aside (a story, a post, an actor's post)
  carries a tick (`input.den-pick`, "Select: ..."); a shift-click on the card selects it too, and a button inside the
  card is still its own. With one or more selected, a bar in the Unsorted tools (`.den-bulk`, "N selected") takes one
  reason (the same list as a single set-aside, with "other") and one button, "Set aside N cards". Each row goes through
  `POST /den/aside {desk, item, reason}` one after the other, exactly as a single set-aside does, so the worker's count
  and its mute offer are what they would be by hand; the offer, when the worker makes one, is shown as before. One
  Undo ("Set aside N cards") clears them all (`POST /den/aside {clear: true}` for each). A failure part way says how many
  went before it; the rest stay on the board. The selection is this render's: it empties on a desk or day change, and a
  card that leaves Unsorted leaves it. Narratives and dates, which the worker does not set aside, carry no tick.
- **A citation chip leads to its card** *(the pane and chips are redrawn in s.10.3; the chip still leads to its card)*. Under "As it reads" a chip is now a button (`button.den-cite`) that scrolls
  its card in the evidence pane into view, focuses it and lights it for a moment (`li.den-evitem[data-cite].lit`);
  the card's Open link is the next press, so the source is one press away. Every id the open section cites and the
  brief's evidence holds is listed in the pane (filed here, or "Cited here, filed elsewhere"), so there is always a
  card to land on; a chip whose evidence has no row stays a plain, red chip as before.
- **A meter under "model calls today".** `.den-budget` holds the count and, under it, `[role="meter"]` (used of the
  cap, from the `budget` the desks route already returns, the same title text as the count): accent to three
  quarters, warn past it, neg at the cap.
- **A day picker in the top bar.** `input[type=date][aria-label="Day"]`, today by default and never later than
  today. Another day sets `to` to the last millisecond of that Sydney day (`dayEnd`, the offset read at noon so a
  clock change cannot move it): the Board reads `GET /den/board?desk=&missed=1&to=`, the checks on the other tabs
  `GET /den/missed?to=`, and the Brief `GET /den/brief?desk=&day=`. The top bar then says "not today" (a warn chip),
  the window line reads "the N hours to the end of that day", and a Today button comes back. On another day nothing
  drafts (no Draft, Draft again or Regenerate: a brief is drafted for today's window only, and the empty state says
  so); saving, filing and reopening an old brief are still a person's. Where a card is filed is kept under that day
  (`ax_den_file_<desk>_<day>`). The day is never kept: a new open is today's. Nothing here spends.
- **The quiet desk.** At 1920 a desk with little filed was a row of ten wide, empty drop zones. A column with no card
  under it is now compact (`.den-col.empty`, `--dn-col-w-c: 160px` against 272 to 316): the same column, with its
  key, its state chip, Write and the drop zone ("Drop here, or press N on a card"), its title on up to two lines; it
  opens to full width as soon as a card is filed under it, and it still takes a drop. At 1920 eight section columns
  now fit on the first screen where four did. The smallest fix that keeps the column structure; the alternatives
  (folding empty columns into one strip, or hiding them) would have cost the one-key filing and the state at a glance.
  The width changes at once, not over a transition: a drag begun while the columns under the pointer were still
  moving started no drag in Chromium (found by the harness, a drop within 300 ms of a filing by key).

Harnesses: `tests/den-browser.mjs` (36: the first case checks the meter and the picker's default; the draft case
presses a chip and finds its card focused, in view, with its source link; three new cases - the bulk set-aside with
the worker's count, the offer and one Undo; the day picker with the `to` it sends, the brief it asks for and that
nothing was written or spent; the compact columns at 1920 with a drop into one), `tests/den-inject-browser.mjs` (60),
`tests/den-worker.mjs` (21) and `node tests/run.mjs check` pass.

Not verified: the live worker and real rows (a busy day's columns at 1366 with compact neighbours; the picker on a
desk with weeks of briefs).

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
| 6.10 | page only, den.js r49 | The Storyboard: a focused window, the Board of cards and section columns, the three-pane Brief (s.6.10) |
| 6.11 | p66, den.js r50 | Where a card is filed is the desk's record (`den_marks.section`) |
| 6.12 | page only, den.js r51 | Bulk set-aside, the chip that leads to its card, the meter, the day picker, compact empty columns |
| 10 | p67, den.js r52 | The release-ready Den: gaps on Collection only, the section editor, the guided tour, working titles, a wider net (s.10) |

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
  morning draft is off for every desk. Discovery, the strip, the board and Preview make no model call. *Amended 16
  November 2026, the owner: narrative naming is automatic within `NARRATIVE_DAILY_CALLS`, every narrative has a computed
  working title, and naming on every tick is built behind `NARRATIVE_AUTO=tick`, off (s.10.5).*
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

### 9.7 Why the database was busy, and the index that ends it (12 November 2026; build `2026-11-12.studio-p64`)

With p63 deployed the collector printed the reason: "the worker's database is busy", twice in two minutes. So the
claim of a job, one of the smallest statements the worker has, could not get a turn.

The database runs one statement at a time. The archive (`arc_items`) held 136,564 news rows. Almost every read of it
says "rows of this kind since this time", and the table had an index on (kind, address) and one on (time) but none on
(kind, time). Asked to choose, the database takes the kind and walks every row of that kind ever held - four months of
articles, text included - to return the last day. 59 of the 65 distinct archive statements that a tick and the main
screens run were answered that way. This is also what was behind the overload of 11 November (s.6.9): that fix made
Anne's Den ask less often, which helped, but each ask still walked the whole kind.

What changed:

| Change | Effect |
|---|---|
| Index `arc_items_kind_ts (kind, ts)` | Those 59 statements walk their window only |
| Made at the top of the next tick, once (or now: `POST /archive/index`) | No setup batch can time out on it; a busy database is tried again next tick |
| `/archive/stats` counted once in ten minutes, four statements in place of eight | Every page load asked it; one of its statements walked the whole table by source |

On a local copy shaped like the live archive (172,470 rows, 553 MB), four of those statements fell from 156-187 ms to
1-26 ms and the index was built in 0.2 seconds. **D1 was not timed**: the evidence on the live worker is the collector
no longer printing "database is busy", and `GET /archive/index` answering `missing: []`.

The owner's step, straight after the deploy (it is also done by the first tick, within half an hour):

```
curl -sS -X POST -H "X-Axiom-Key: $AXIOM_KEY" https://newsaus.heshan-998.workers.dev/archive/index
```

`{"ok":true,"made":["arc_items_kind_ts"],"ms":...}` is the answer wanted. `db_busy` means the database was mid-scan:
wait a minute and ask again.

## 10. Release 8 - the release-ready Den (16 November 2026; build `2026-11-16.studio-p67`, page `den.css?v=r48`, `den.js?v=r52`, five new part files at `?v=r1`)

Branch `claude/den-release`, cut from `main` at c2cff62 (worker p66, page `den.js?v=r51`, `den.css?v=r47`). Merged to
`main` (93bf0fd) and live on GitHub Pages on 16 November 2026; the owner deployed the worker the same day at 06:08 UTC
(s.10.8 records the deploy). The page is now six files: `docs/den.js` (the shell: shared
helpers, the rail, the Board, the top bar, `DenApp`), `docs/den-brief.js` and `docs/den-brief.css` (the Brief),
`docs/den-desk.js` and `docs/den-desk.css` (Watch, Collection, Options), `docs/den-tour.js` and `docs/den-tour.css` (the
guided tour), with `docs/den.css` still the frame and the tokens. `den-brief.js` and `den-desk.js` are factories that
`den.js` calls once with its shared names (`window.__DEN_PARTS`); the tour reads the page only through `data-tour` hooks
and `den:did` events. The versions `r52`, `r48` and `r1` were set when the split began and none was ever served (`main`
serves `r51` and `r47`), so no second bump was needed.

### 10.1 What the owner asked, and what it reverses

The owner's brief for this release, in its sense: (a) a delivery or collection problem ("Facebook delivered nothing in
this window", the "Not collected" check) is shown **only on the Collection tab**; (b) a release-ready, professional Den,
above all a redesigned section editor and evidence pane (his screenshot: a textarea of raw `[S:123]` codes stacked above
a duplicate "As it reads", and evidence cards headed by raw ids with "not filed" under each); (c) a wider collection net
and narratives named without anyone asking, nothing left waiting un-analysed; (d) better engines, logic and flows; (e) a
guided tour from the first step to the last that rings the control to press, waits for the person to really do it, and
on later visits asks whether they want it again.

| Standing rule | What this release does | Decided by, when |
|---|---|---|
| "An empty table must never be read as a quiet day": gaps first on the strip, a gap line on the Board, gaps in every "not covered" count (s.6, s.6.10) | **Reversed outside the Collection tab.** Gaps are said on Collection only, with a neutral dot on its tab (s.10.2). Failed reads are not gaps and still show on every tab | The owner's instruction, 16 November 2026 (item a) |
| The draft is told to "say so plainly" when a channel was not read (`denSys`, `DEN_KIND_GUIDE.social`) | **Reversed in worker p67.** The draft never writes about collection, collectors, sign-ins or repairs; one built line says which channels were read (s.10.2) | The owner, 16 November 2026 (item a); takes effect on the deploy |
| The Storyboard editor: a textarea, "As it reads" under it, cards headed by their id (s.6.10) | **Replaced** by one section page, read by default and edited in place, and evidence cards headed in words (s.10.3). What is stored is unchanged | The owner, 16 November 2026 (item b) |
| D4: automated model work, naming included, runs in one window a day (5 October 2026) | **Amended, not reversed.** Every narrative has a working title at once with no model call; the morning window now drains the whole naming queue within the same cap; naming on every tick is built behind `NARRATIVE_AUTO=tick`, **off** (s.10.5) | The owner's item (c), 16 November 2026; switching every-tick naming on is still his |
| Filing and the desk's record are a person's act; nothing spends without a button that states its cost | **Kept.** The tour asks the person to press; it never presses, never makes a request and never spends (s.10.4) | Unchanged |
| Keyword proposals need a person; no signed-in channel, paid source, lexicon term or cron cadence changes without the owner | **Kept.** The wider net uses existing keyless routes only (s.10.6, s.10.9) | Unchanged |

Pointers are left where the older text stands: s.6 ("Nothing critical missed"), the s.6.10 table, s.6.12 (the chip
that leads to its card) and D4 in s.0.7 and s.7.3.

### 10.2 Collection gaps live on the Collection tab only

Supersedes the page behaviour in s.6 ("first in the list - any channel the desk relies on that delivered nothing") and
in s.6.10 ("six pills on the rail, gaps first ... A gap is also said on the Board").

| Where | Before | Now |
|---|---|---|
| The rail | Six pills, "Not collected N" first, warn-coloured, on every tab | Five checks; a desk with only a gap says "five checks, nothing found". The strip still hands the full list to `DenApp`, so Collection has it |
| The Board | "<Channel> delivered nothing in this window. Not a quiet day: see why" above Unsorted; a column's "N checks uncovered" in red | No gap line. Before a brief there is no check count at all; with a draft a column says "N checks not in the brief yet" in a neutral chip; after filing, "N acknowledged at filing" |
| The Brief | "1 check uncovered" counted the gap; Mark as filed listed it | Gaps are dropped before anything is counted. A filing whose only open items are gaps files in one press (the page sends `acknowledge` itself under p66); a gap and a check list only the check |
| The draft (worker p67) | Told to write which channels were not read, and did ("restoring the collector should be a priority") | `SIGNALS NOT TO MISS` carries no gap; one built line follows the desk: `CHANNELS READ IN THIS WINDOW: News (n rows), X (n rows); not read: Facebook.` The rule: never describe a channel that was not read as quiet or calm, draw nothing from its absence, never write about collection, collectors, sign-ins, feeds or repairs |
| Filing (worker p67) | Gaps in `409 uncited_signals` and in `acknowledged` | `open` excludes gaps; `acknowledged` holds none; the revision note appends "; not read in this window: <channels>" (see below) |
| Watch | A collector's `last_error` in red beside each account | The last good read ("3 h ago") or "not read yet", in neutral ink |
| **Collection** | The channel table only | A first panel, **Not delivering** (`[data-tour="gaps"]`): each gap with the worker's own title, its reason as sentences, secret, permission and script names folded under a closed "Setup details", and one action - Collect now where the channel has a collection route and the key can write, otherwise what is missing (switched off, paused at a verification, no collection job, a full key needed). "Checking what each channel delivered..." while the checks load; a sentence and Try again when they could not be read; "Every channel this desk relies on delivered." when none. On a past day it says "For <day>" and that the channels are as they stand now. A gap's row in the table carries a warn rule; Collect now is disabled with its reason on the three channels that have no collection job |
| The Collection tab | - | A neutral dot (`data-attn`, CSS only, no number, no warn colour); the tab's text stays exactly "Collection"; `aria-description` "A channel is not delivering" (decision D5 of the plan; deleting the attribute in `DenApp` removes it) |

Still said on every tab, because they are not "a channel delivering nothing": a read that failed, `503 db_busy`, a
wrong-shape answer (each with Try again); the Board's "X: none." sentences, which say what was **collected**, with the
link "See what was collected, and why not"; the Watch form's note that no collector reads a platform being typed.

`GET /den/missed` and `/den/board?missed=1` are unchanged (gaps are still computed and still first), so the page reads
the same under p66 and p67 and a p66 page still works on p67.

**One open conflict for the owner.** The plan asked the worker to keep the unread channels in the filing revision note
(W1), which appears in History on the Brief tab. The page strips that part from the History table, so item (a) holds on
the page; the worker still stores it. Whether it should stay in the note, move to a field of its own, or go, is the
owner's call. Dropping it is two changes: the suffix in `denBriefFile`'s `denRevision` call, and DK12's gap-only note in
`tests/den-worker.mjs` (expect "filed").

### 10.3 The Brief's editor and evidence pane

Supersedes the Brief row of the s.6.10 table and the citation chip of s.6.12.

| Where | Before (r51) | Now (r52) |
|---|---|---|
| The section | A textarea of raw `[S:123]` codes, then "As it reads" under it: the same words twice | One page a section (`.den-sec[data-mode=read|edit]`). It opens **read**: the words with each citation a numbered chip and each flag at its sentence. Clicking a sentence, Edit, or Tab puts the caret at that sentence in the same place; Esc or leaving saves once and returns to reading (focus goes back to Edit). An empty writable section opens as the editor. A filed brief or a read key always reads |
| Typing | Raw codes only | While editing, a mirror under the text tints each `[K:id]` (the one under the caret ringed, an unknown id red), and a line names the mark under the cursor: its source, what it says, its id |
| Citing | A card inserted `[M:n]` where the cursor last was; each card a save | A card press keeps focus in the words and inserts at the caret through the browser's own edit, so Undo works and several citations are one save |
| An evidence card | Headed by its id (`S:2396192`, `T:mining`, `N:...`) with "not filed" under every row | Headed by its source in words with the kind's icon, then what the row says and one line of figures; the id only in its accessible name and tooltip. Filing words only on rows the desk can file (stories, posts, actors, narratives, dates): "Add to this section", "Remove". Tone, alert and memory rows say nothing about filing. A card cited here shows its chip's number; "Cited in N" when elsewhere too |
| Chips | The outlet name | "pointpost", "pointpost 2" for a repeat, "Narrative: <name>", "Tone: <issue>", "Agency memory", "Date: ..."; the number is drawn by CSS, so the text a test reads is unchanged |
| The outline | Titles cut at one line, a key cap past nine | Sections numbered 1..n, titles on two lines, a quiet dot and a word for the state, and the count of sources (filed cards and cited ids, each once) |
| The foot | Text counts | Buttons: "N need(s) a source" opens the first flagged sentence, the checks chip opens the section of the first check not mentioned |
| Failures and finish | A toast | A failed draft or section rewrite stays as a notice until closed; a filed brief shows a band with "Copy it for the document"; Regenerate saves unsaved words first, and Write it again is disabled with "Save your edits first" while anything is unsaved; History and Compare open in a drawer that takes focus and gives it back |

What binds, unchanged: the section text the worker stores and checks is still plain text with `[K:id]` tokens; only an id
the brief's evidence holds can be cited; flags sit at their sentence; the working copy, save and conflict rules of s.6
stand; other sections stay mounted so unsaved words are not lost. `DEN_EDITOR_STACK = false` in `docs/den-brief.js`
brings back the r51 stacked layout with the new cards (verified to pass `tests/den-browser.mjs`).

The worker side (p67): every evidence id records `text` (at most 160 characters) and `sub` (at most 120) for every
kind, returned by `GET /den/brief` beside `label` (never the line itself, never a subscriber excerpt); a brief drafted
before p67 derives them from its stored line. A social row's label is "<platform> post" only, so the Source List prints
no post words. A brief started by hand fills its evidence from the window at once (no model call), a save that cites a
row collected since then merges it, and a section rewrite refreshes the lines it holds. A sentence flagged "Needs a
source" keeps its flag through later saves until it is cited or removed. Tone (`T:`) counts only rows a model judged.

### 10.4 The guided tour

`docs/den-tour.js`: one script with no dependency, mounted as `#den-tour` on `document.body`, opened by the **Guide**
button beside `?` and by the first row of the Keyboard sheet. Twenty-four steps in six chapters, each finished only by
the real action (a click, a drag, a key, words typed, read from the page and the Den's `den:did` events):

| Chapter | Steps |
|---|---|
| Set up | Choose your desk; Check the day (and the model-call meter beside it); Read the checks |
| Sort the evidence | Meet a card; Find a card; Pin what must be covered; Set one aside (with Undo and the mute offer); Add it to a section (drag, or the card's menu); Do it with one key |
| Start the brief | Open the brief; Start the brief (paid: the Den's own Draft, or "Skip: show me with a sample") |
| Write and cite | Open a section; Edit the words; Cite a card; Save; Follow a citation; Rewrite one section (paid form: only the person presses Write it again) |
| File and share | Look back; Read the foot before filing; Take it out; Mark it as filed ("Not yet, show me the rest" in the dialog) |
| Run the desk | See what is watched; See what was read (rings Not delivering when there is a gap); Make the desk yours |

How it behaves: a ring and a cut-out spotlight on the control (the page underneath stays usable), a coach card with
"Step n of 24", the chapter and a progress bar, Back, Skip this step and "I'll do it later". Each write step says what it
will write and how to undo it before the press. After 20 seconds it offers "Show me where"; after 45 Skip becomes the
first button; nothing skips by itself. Where the page is not in the state a step needs it asks for the one press that
fixes it ("Come back to today", "Go back to the Brief", "Save your words first"). Alt+G moves between the card and the
control; Escape pauses and returns focus; a Den dialog keeps its own Escape. Under reduced motion the ring is a static
3px outline with a "here" badge.

What it never does: press a Den control, make a network request (its harness greps for `fetch(`, `XMLHttpRequest`,
`AXUI` and `.click(`), or spend. A control marked `data-paid="1"` gets a dashed ring and "1 model call, you press it"
with the day's live count; the sample path makes no call. Collect now is never offered. A read key walks every step as
"shown, not done"; an empty desk folds the sorting chapter into one card; a filed brief makes editing show-only and
points filing at Reopen.

Entry: a first open offers a welcome (Start the guide, I'll do it later, Don't ask again); a guide left part-way offers
"Carry on with the guide?" at its step; after it ends or is declined, each open asks "Want the guide again?" ("Want a
guided tour of the Den?" for someone who never started) until "Don't ask again". Its memory is this browser's note,
localStorage `ax_den_tour` `{v, status, step, done[], skipped[], sample, ask, runs, startedAt, updatedAt, completedAt,
t, w}`, read and written in try/catch. Removing the two `den-tour` tags from `docs/index.html` removes it; the Guide
button and the sheet row hide themselves.

### 10.5 Naming and analysis without a person (D4 amended)

Three things left a narrative showing "A narrative not yet named": naming was held outside the 07:00 window; the Board
lists narratives from two rows but a model names from three, so a two-row narrative could never be named; and past the
120-call cap the rest waited for the next day.

- **A working title, no model call.** Every narrative carries one (`narratives.auto_label`, with `auto_n`,
  `label_tries`, `label_try_ts`, each added once by `ALTER TABLE`). Only a published **news headline** can be one: the
  member headline that carries most of the cluster's shared words, cleaned (outlet suffix, "Live:", handles and links
  out, at most 14 words), and only if a strict check finds no possible person's name in it (any capitalised name in any
  script, initials, a lone surname, a speaker followed by a speech verb; a short list of institutions, places, days and
  months is let through). Otherwise a template from the issue, the register's names and words the rows write in plain
  lower case. Never a comment, never a post's sentence, never an unregistered person. Written at insert, refreshed only
  when the narrative doubles (so a title a brief cites is stable), back-filled 60 a run, and built lazily on the Board
  for rows older than p67 ("A narrative on <issue>"). A person's name always wins, then a model's.
- **Said as what it is.** Board rows carry `named` (`person`, `model`, `auto`); the card shows a quiet "working title"
  tag; the draft's line reads "working title, not yet reviewed"; an emerging signal reads "Emerging narrative (working
  title): ...". `/narratives/status` adds `titled`, `awaitingModel` and `budgetAuto`.
- **The window drains the queue.** The morning window now names the whole global queue of the last seven days, client
  issues first, within `NARRATIVE_DAILY_CALLS` (120) and a window budget of 20 calls and four minutes, each row claimed
  before its call; three failed attempts set a narrative aside until the next day.
- **Every-tick naming, built and off.** `NARRATIVE_AUTO=tick` lets a held tick name client-issue narratives that moved in
  the last day: two batches (up to four provider calls) a tick at most, on its own ledger scope `narr_auto`, capped by
  `NARRATIVE_AUTO_DAILY_CALLS` (default 24 a Sydney day), never when `AI_AUTOMATION=off`. The default `window` spends
  nothing new: `tests/ai-automation-worker.mjs` passes unchanged.

D4 now reads: a draft or one section written again is still one call a person starts; narrative naming is automatic
within its own cap, and every narrative has a computed working title until a model or a person names it.

### 10.6 The wider net

| What | How it is read | What is kept |
|---|---|---|
| The tick, measured | 22 stages timed in `handleScheduled`, written to KV `tick_last` (a partial record after the collectors) | `/den/collection` returns `tick` and `pipeline` (rows waiting to be grouped, the oldest, working titles, names waiting); the Collection tab shows them under **Analysis** only when sent |
| Core-feed news on the Board | Core feed rows now carry `meta.issues`, `source`, `tier`, `juris`, `outlet` (a Google News outlet moved off the headline) and are archived before the snapshot's 120 cut, 600 a tick, newest first | Media cards under the outlet's name; the News channel's counts include them |
| A back-fill of tags | 300 news rows of the last seven days a tick, newest first (KV `tagfill`); worker-tagged rows are tagged again after a desk term is approved | `meta.issues` where it was absent, `meta.tagv` on rows the worker tagged |
| Bluesky search | `api.bsky.app` first, the public host after a 403 (recorded as `social_last.bluesky.host` / `fallback`); every desk-owned term first, then ten others in turn; stops after three failures in a row, five seconds a search, 180 seconds a run | As before |
| X timelines | Up to 20 registered accounts of the desks every run (`X_DEN_EVERY_RUN`), never more than half the run | As before |
| Google News by issue | 14 issue OR-queries a lexicon run, the desks' issues every run, the per-term rotation kept as the deep pass | `meta.q` holds the query that found a row |
| Three seed sources | `v67_lemmy_world_au`, `v67_guardian_energy`, `v67_treasury_ministers`; `wn_aemc` reads its own feed first | Unverified until the owner's sweep |

No lexicon, signed-in route, paid key or cron cadence changed. The legacy `/collect` tail still runs, now timed as
`legacy`.

### 10.7 Verified here, and not verified

Every harness below ended N passed, 0 failed on the release head, run from the `den-release` worktree:
`node tests/run.mjs check` (30), `tests/den-worker.mjs` (22), `den-release-worker` (6, new), `den-autoname-worker` (15,
new), `den-widen-worker` (11, new), `narratives-worker` (18, unchanged), `ai-automation-worker` (4, unchanged),
`widenet-worker` (12), `social-worker` (16), `collect-hardening-worker` (19), `auth-policy-worker` (20),
`studio-tokens-test` (6; TK6 holds the tour's inks to AA), `den-browser` (36), `den-inject-browser` (60),
`den-gaps-browser` (12, new), `den-editor-browser` (12, new), `den-collection-browser` (10, new), `den-tour-browser` (11,
new), `den-visual-browser` (14, new), `den-release-browser` (7, new). Four release reviews (engine truth, the
experience, page correctness, rules and accessibility) were read against the code and fixed with tests first. The
full `node tests/run.mjs all` was not run here; CI on the pushed branch is the full run.

| Not verified | Why | What verifies it |
|---|---|---|
| The live worker and real rows: the Board, the rail and Collection on a real desk | The sandbox contacts no live worker | Open the Den after the deploy, Board then Collection |
| A real draft under the new prompt: no collection talk, the channels line | No paid model call is made here | One draft on the live worker, read against her report |
| Working titles on real clusters, and that none names a private person | Seen only on invented rows | Narratives, sort by new, a day after the deploy |
| Naming spend on a real day under the window drain | Not run against the account | `/narratives/status` `budget` and `budgetAuto` the day after |
| Bluesky from Cloudflare's egress (which host answers) | No egress | `social_last.bluesky.host` and `fallback` after a two-hourly run |
| Google News tolerance of 14 more requests a run | No egress | `lex_gnews` in Sources a day on: delivering, not refused |
| The tick's real wall clock and CPU with the new stages | Cannot be timed here | `tick` on the Collection tab after two ticks |
| The three seed sources | No egress | Sources, filter Untried, Sweep |
| The tour on a live desk (its writes are real) | Only the fixture's desk | One walk with a full key, then Undo on the Board |
| The look with the vendored fonts and real data at 1366 | Shots are of the fixture's invented day | The owner's first open |
| Firefox and WebKit | Not installed here | CI |

### 10.8 The owner's steps for this release

Done on 16 November 2026. The branch was pushed, CI ran on it, and the owner merged it to `main` (93bf0fd); GitHub Pages
then served `den.js?v=r52`, `den.css?v=r48` and the five part files at `?v=r1`. A first deploy at 04:58 UTC ran before
the merge and uploaded the p66 code again, which changed nothing. The owner deployed again from the merged `main` at
06:08 UTC: the live worker answers build `2026-11-16.studio-p67`, revision 93bf0fd, deploy token `aa4787ea59c482f4`, and
`/engine/status` answered 200 after the upload. Bindings, vars, secrets and crons were unchanged. Still open from s.10.7:
real rows, a real draft under the new prompt, working titles on real clusters, and the tick's real wall clock (items 3,
4 and 6 below).

```
git push origin claude/den-release                                                   # then wait for CI to pass
tools/deploy-worker.sh --dry-run && tools/deploy-worker.sh                           # the worker, from the Mac, from the branch tip
git checkout main && git merge --ff-only claude/den-release && git push origin main   # the page; GitHub Pages serves main /docs
```

1. With `AXIOM_KEY` exported the deploy proves the build: `/engine/status` answers `2026-11-16.studio-p67`. The live page
   r51 keeps working on p67. Open Anne's Den once with a full key; the four new `narratives` columns are added by
   `ensureNarratives` the first time the narratives tables are touched (the next tick at the latest).
2. After the merge, hard refresh once (Cmd+Shift+R); the page loads `den.js?v=r52`. If the page goes out before the
   worker: gaps are already off the rail, Board and Brief, the editor and the tour work, but a new draft is still told
   to write about unread channels and narratives still show "A narrative not yet named" until p67 is deployed.
3. Read `tick` on the Collection tab after two ticks. Raise `SOURCES_PER_TICK` only if the tick total is well under
   five minutes.
4. Sources, filter Untried, Sweep (the three new seeds); a day later, filter Failing and Dead.
5. Off or unchanged on arrival, and the owner's: `NARRATIVE_AUTO=tick` and `NARRATIVE_AUTO_DAILY_CALLS`; a cheaper
   `NARRATIVE_MODEL`; tone judged more than once a day; the Collection tab's dot (one attribute); the revision-note
   suffix (s.10.2); whether a published headline with evaluative words may stand as a working title; every Mac
   `--login`, source clearances, `OPENAUSTRALIA_KEY`, the Meta permissions, the Supermetrics licence and
   `tools/den-backtest.py ... --save`.
6. One draft on a live desk, read against her own report for the day: the acceptance test no harness runs.

### 10.9 Asked for and not built, with the reason

- **Auto-approval of proposed keywords.** The proposer counts and does not understand (s.5); approval stays a person's.
- **Signed-in channels, paid sources, a second cron, Hansard on the Board.** Not asked for by name and each is the
  owner's decision; the net was widened through existing keyless routes only.
- **Naming on every tick by default, tone every tick.** Built behind `NARRATIVE_AUTO=tick` (naming) and left off; tone is
  unchanged. Both are spend the owner switches on.
- **The legacy `/collect` tail removed.** Nothing could confirm that no reader depends on the keys it writes.
- **Stable `U:` and `K:` ids.** The page cites an upcoming card by its position; it needs a page change first.
- **A plain Status column on Collection, Draft disabled on an empty Board, the Upcoming card titled in words.** Each
  conflicts with an assertion of `tests/den-browser.mjs` that pins today's text; left for a release that rewrites them.
- **The tour's "Try it: Collect now".** It would start real collection; Collection is explained, not pressed.
- **`docs/narratives.js` and `docs/overview.js` preferring the working title**, outlet display names, a `[` citation
  picker, a summary band and chevrons on Options: optional, left out.
- **A light theme, phone and tablet layouts.** Out of scope by standing rule (dark, desktop first).

### 10.10 Draining the queues on 16 November 2026: two bugs found and fixed (build p68)

Branch `claude/narr-drain-fix`, cut from `main` at b242482 (the live p67). The owner asked for all pending AI analysis to
be finished. `tools/daily-brief.py --only sentiment` drained cleanly (731 rows in 37 steps). `--only narratives` did not,
in either of two runs (the second started sixteen minutes after the first, which was still going): 400 place steps each
reported "100 scanned, 100 placed (0 joined, 100 started)" while "remaining" stayed at about 130, and the one naming batch
failed with "the naming model answered without valid JSON", after which the drain stopped with 642 narratives waiting.
Both causes were confirmed by reading the code, the first also by a harness, before anything changed.

1. **Placement looped (older than p67).** A run takes the oldest unplaced rows of the last 72 hours and, at its end,
   prunes every singleton with nothing newer than 48 hours, freeing its rows "to be placed again". A row 48 to 72 hours
   old that joined nothing started a singleton whose newest row was itself, the same run pruned it, and the next run took
   the row again, first in line: reproduced on p67 as "5 scanned, 5 placed, 5 started, 5 pruned, remaining 5" on every
   step. The tick (300 a pass) got past them but spent those slots and their embeddings every pass. Now one constant,
   `NARR_SINGLE_KEEP_H` = 48, sets both the prune and a new rule applied when the run writes: a cluster the run started
   that is still one row, and whose row is older than that, is not written as a narrative; its row is set aside
   (narrative `''`, counted in `unanchored` and in the new `aged`). Rows of the same run may still join an old row's
   cluster, so a story whose rows all reach placement 48 to 72 hours old (a backlog after an outage, rows freed by
   **Dissolve broad clusters** or a reset) still forms its narrative, and a story keeps its first report as its first row.
   (The first p68 commit applied the rule when a row would start a cluster; the review found that it stranded those
   stories for good, so it moved to the write.) An old row still joins a live narrative it matches; a younger row still
   starts one; the prune of singletons that never grew is unchanged. A singleton written 24 to 48 hours old is never a
   candidate again (`NARR_SINGLE_CAND_H` = 24, which must stay at most `NARR_SINGLE_KEEP_H`), so its row comes back once
   after the prune for one more look against what formed since, and is then joined or set aside: one extra embedding a
   row at most, where p67 looped for ever.
2. **One long batch failed, then blocked the queue.** `narrLabelBatch` gave five clusters 300 + 5 x 260 = 1,600 output
   tokens for a label, a two-sentence summary, claim, counter, proponents, issues, scope, relevance and why each, and its
   retry used the same limit. The ledger shows two answered calls and one retry, so both answers came back and neither
   parsed; whether they were cut off or prose is not in the logs, because `claudeMsg` reports `stop_reason` through
   `acct.info` and `narrLabelBatch` never asked for it. The name step then took the five largest eligible narratives with
   no regard to claims or strikes; the failed five were claimed for two minutes, so the next step claimed nothing, made no
   call, and the tool stopped. Now: the budget is 600 + 450 a cluster (2,850 for five, at most 4,096); an answer that
   does not parse is asked again in halves, then the singles of a half that failed, and a batch of one once more with
   the JSON-only nudge, so one unnameable cluster takes its own strike and the others are named; a declined answer is
   split the same way, and so is an answer that does not come within the call's 45 seconds; any other provider error is
   not; two singles failing with nothing named stops the splitting. A batch of five costs at most eight provider calls
   (five, three and two, then the five singles, when a single has been named); one the model cannot name at all costs
   five. Each provider call is reserved and settled on the same ledger scope (`narratives`, or `narr_auto`) and checked
   against the day's cap and the run's share before it is sent. Errors name the narratives and the reason ("cut off at
   max_tokens 2850", "not JSON", "declined", "no answer within 45 s"); the answer's first 120 characters go to the console
   line only, because the page and the tool read errors for budget and spend-limit words and a narrative about the federal
   budget or bulk billing would otherwise stop them (found in review). `calls` now counts provider calls, the ledger's own
   unit; p67 counted a batch and its retry as one, which made `NARRATIVE_AUTO=tick`'s two a tick up to four and the
   window's 20 up to 40. The name step uses the window's own queue (`narrLabelQueue`, one batch a press, no call started after
   135 of its 150 seconds), so it skips narratives in a claim or set aside after three failures today and names only those
   active in seven days, and it answers `remaining` (what can be named now), `setAside`, `claimed` and `stopped`.
   A batch can stop inside its split (the cap, the run's share, the clock): what it sent and did not name keeps its claim
   and its strike, and only what was never sent is released, so a batch the model cannot name builds its three strikes
   and is set aside (the first p68 commit released all five, which brought the blocked queue back; found in review). A
   split can also outlast the two-minute claim, so the drain renews its claims on every narrative of the batch still
   waiting before each call (`narrRenew`, compare-and-set on the claim time it holds); a second drain pressing meanwhile
   never sends the same five, and one whose claim was taken is dropped, never asked again by the first.
   `tools/daily-brief.py` goes on past a step that named nothing but made a call; it stops at `remaining` 0, on the
   budget, on an account limit, after two steps in a row with no call, or after three steps in a row that made calls and
   named nothing (showing the first error); and it stops placing when ten steps in a row leave the backlog no lower. The
   page's **Finish all waiting** loop is unchanged (no page change in p68): it stops on the budget or the account limit
   read from errors, which now carry no model words, at `remaining` 0, after a step with neither a name nor a call, or
   after 80 steps.

Tests first: `tests/narr-drain-worker.mjs` (23: A1 to A9, B1 to B12, C1, C2) and `tests/daily-brief-test.py` (11). Of the
first fourteen worker cases eleven fail on p67 (A2, A3 and A5 are guards that already held); of the first nine tool cases
six fail on p67's tool. A7 to A9, B7 to B12 and the two tool cases on steps that spend calls and name nothing came from the
review of p68: A7 to A9 and B7 to B11 failed on the first p68 commit (5eb1da0), B12 pins the eight-call bound, and B4 and
B5 were tightened (the model's words stay out of errors; a stop keeps the strikes of what was sent and releases only what
was never sent). One assertion changed: `tests/den-autoname-worker.mjs` AN11
pinned p67's count of one call per strike where two provider calls were sent and settled; it now expects two.
Not verified: the live answers themselves. If the `ai_usage` row for scope `narratives` and day `20261116` held about
3,200 output tokens over its first two settled calls, they were cut off. The owner's steps: deploy p68
(`tools/deploy-worker.sh --dry-run && tools/deploy-worker.sh`; no page change, `docs/narratives.js` reads the same
fields), confirm `/engine/status` answers `2026-11-16.studio-p68`, then run `tools/daily-brief.py --only narratives` once.
The rows that looped are set aside or joined by the first tick after the deploy.

**Deployed and drained (16 November 2026).** The owner deployed p68 at 09:40 UTC (revision 5fd5573, deploy token
`a38a7d54ef16b8d4`) and `/engine/status` answered `2026-11-16.studio-p68`; the drain was run once more, guarded on that
build. Placement set aside the 126 looping rows in two steps and the backlog read 0. Naming made 34 calls (36 of 120 that
day, counting the two failed calls before the deploy) and named 166 narratives, leaving none that could be named; every
one of the 34 answers parsed at the larger output budget, which fits the cut-off reading without proving it. Nine
emerging narratives raised their Slack alert as they were named. Tone verdicts the same day: 731 rows in 48 calls before
the deploy and 260 more in 15 calls after it (63 of 300), queue at 0. No name was a private person's (all 166 read).

### 10.11 One story, one narrative: duplicates prevented, proposed and merged with an undo (build p69)

Branch `claude/narr-merge`, cut from `main` at 5fd5573 (the live p68). After the p68 drain the narratives list showed one
story spread over several narratives. A census of the 300 live narratives of 16 November 2026 (read-only) found 34 groups
of narratives telling one story: 96 narratives (a third of the 300) and 704 rows; consolidating them would retire 62
narratives. 14 of the 34 groups span more than one client namespace; none of the 300 was edited, pinned or muted; 11 had
alerted; no counter pair was set. The causes, ranked by the evidence:

1. **The join bar sits where the same story in another text form lands.** bge-base puts the same story across outlets at
   about 0.84-0.93 and unrelated political headlines at 0.70-0.83; a bare headline (the lexicon sweep stores no body), a
   forum page with its boilerplate or a short post scores just under the 0.84 bar against a centroid built from
   body-rich articles, with the shared issue present. The p68 drain's rows that started a narrative had their closest
   live narrative at median 0.75, 90th percentile 0.83, 19 of 100 between 0.80 and 0.84. Syndicated copies of one
   headline give the new narrative three or four rows at once. Lowering `NARRATIVE_SIM` does not fix it: at 0.80 a sibling
   story placed first moves the centroid and joins instead (order-dependent over-merge), at 0.82 nothing changes.
2. **Nothing ever consolidated.** Once two narratives on one story exist, each new row joins the closer one and both grow;
   no step compared narratives with each other, and the manual merge kept no record, so it could not be undone.
3. **Late rows and the prune.** A row placed 24-48h after its own time started a singleton that was never a candidate
   (the candidate window counted from the row's time); 33 of the 300 were made 47-50h after their first row, the prune's
   signature.
4. **The recount wiped the entity anchor.** `narrRefresh` replaced `entities` with the sentiment entities, empty until
   rows are judged: 178 of the 300 had none, so a row sharing only an entity needed 0.91 across runs instead of 0.84.

Side findings: the all-capitals alias `PHON` matched "phones" (the matcher allowed a plural on every alias), and two
placements at once placed the same rows twice and left a ghost narrative counting rows it no longer held (reproduced).

**What changed (no model call anywhere; no page change).**
- **P1, the near-miss join (near mode, default `shadow`).** A row within 0.05 of its bar that joins nothing may join the
  closest such candidate when the candidate's member evidence (as the narrative stood when the run began: its stored
  amplifier titles, its 40 most recent story titles and its label, each of four or more words) covers the row's
  headline: IDF over the run's candidates' term maps, register names and issue words dropped, possessives stripped, at
  least 0.45 on two or more shared words; the row must not lean to the candidate's model counter-claim, the anchor must
  hold and the candidate must have had a row within 48h. At most three near joins into one narrative and twelve
  candidates' evidence read a run; in mode `on` a row past either cap waits unplaced for the next run (recorded `capped`
  when it qualified; never a narrative of its own, never set aside). Every near miss looked at is recorded in D1
  `narrative_near` (`on` joined, `shadow` would have joined, `miss` did not qualify, `capped` waiting, with sim, the
  cover, the shared words and the lean; kept 14 days; a reset retires the records of what it dissolves as `reset`);
  `POST /narratives/near {undo: item | 'day', day}` puts near-joined rows back in the backlog (or sets aside those
  outside the 72h window), takes their words off the narrative's terms and recounts it, at most 100 a call in one batch
  (`more: true` until the day is done); a row no longer on that near join (a reset, a merge, a later run moved it) is
  left where it is and its record closed as stale; an undone row is never near-joined again. Every new narrative stores
  `born_near`, `born_sim` and `born_bar` (the closest live narrative and the bar it missed), and the merge pass counts
  how many proposals were born within 0.05 of their survivor (`nearBorn`): P1's reach.
- **P2.** A singleton is a candidate for 24h after it was placed as well as after its row, except one whose first row is a
  recorded would-join (`shadow`) of a live narrative: that row is a late near miss of a story that has its narrative,
  and as a candidate it grew a duplicate across runs that nothing consolidates at the defaults (review); it stands alone
  as in p68. The prune waits for both clocks, and a pruned singleton's row about to leave the 72h window is set aside
  instead of freed (`prunedAside`).
- **One alert a story.** A narrative whose first row is a recorded would-join of another live narrative is read after the
  others by the alert pass and raises no alert once that narrative (or its survivor) has alerted, unless a person kept
  the two apart (`alertsHeld` in the run). `/narratives/status.merge.nearBorn` counts the standing near-born narratives
  (`standing`) and those that began with a would-join (`wouldJoin`), with ten named.
- **P3.** The recount keeps the entities placement wrote while no row has a sentiment verdict.
- **P4.** An all-capitals alias takes no plural.
- **P5.** A D1 lease (`narr_lease`, three minutes, freed in a `finally`) around placement, the prune, every merge, undo,
  near undo and reset; a busy placement skips placing and still recounts, titles, scans and names. Each placement first
  moves rows left on a merged-away id to its survivor; once an hour it puts rows on a missing narrative with no merge
  behind them back in the backlog (inside the window) or sets them aside (`out.repaired`).
- **The merge pass (merge mode, default `propose`).** Once a tick, after the recount and the titles and before naming,
  model-free: up to 600 candidates (the 400 most recent and the 300 largest of the last week, two or more rows, not
  muted or broad); for every pair the centroid cosine `c`, an IDF term cosine `T` over the 40-term maps (names, issue
  words and filler dropped) and the census word score `S` (the JS port of the census scorer: U .45, H .25, X .15, E .05,
  Tm .10), with `S_auto`, the score the automatic clause reads: the same weights over bags without the register's
  person and party words (a name links a story and its same-actor siblings alike; organisations and topics stay), with
  the best headline pair replaced by the best disjoint one in H and the words only that pair brings left out of U and X
  (review: the first build took the shared row out of H alone, and one live-blog row still carried U and X), plus a
  model-free opposite-claim veto from stored claims and counters. The scan is bounded by the pairs it scores (80,000 a
  tick, `NARRATIVE_MERGE_PAIRS` 10,000-400,000; the dry route 400,000), not by a clock. A pair is
  proposed by the first rule that fires (`centroid` c >= C_HI; `strict` no anchor and c >= 0.91; `form` c >= 0.79 and
  T >= FORM_T; `centroid+words` C_LO <= c < C_HI and S >= 0.25; `words` S >= 0.45; `terms` no centroid and T >= FORM_T)
  and listed with its holds: `opposite`, `undone` or `kept` (keep-apart), `person` (edited or pinned), `clients` (another
  namespace), `scope` (exactly one side `off`, or a politics survivor absorbing a client narrative), `naming` (in a naming
  claim), `size`, `member`, `cap`, `paused`, `keeps` (the keep-apart list was too long to read whole: nothing merges by
  itself). A pair is automatic only with no hold, a shared leading issue or entity,
  spans within 24h, the member check (complete link: the clause holds against the survivor's pre-merge state and every
  narrative it absorbed automatically in 96h or earlier in the tick, so drift never snowballs a survivor; and, review,
  every narrative the absorbed one took automatically in 96h passes the clause and holds no opposite, keep-apart,
  clients or scope hold against the survivor, so a chain never puts a narrative where its direct pair could not go) and the clause
  in force: the centroid clause c >= C_HI and S_auto >= S_CORR, or the form clause (`s`: c >= C_FORM and S_auto >= FORM_S;
  `t`: also T >= FORM_T). Decisions are taken per connected component with the component's largest narrative as the
  survivor, under caps of 5 a tick, 40 a Sydney day and 3 a survivor a day; three automatic merges undone within 24h
  pause the automatic pass until a person posts the mode again. Each apply re-reads both rows, the pair's own
  keep-aparts and re-scores the pair under the lease; the counter pointers are part of its compare-and-set. KV
  `narr_merge_last` (7 days) holds the true count (`proposalsN`), the first 100 proposals in a slim form that fits
  (ids, titles, c, T, S, S_auto, H2, the rule, the holds), the holds counted by kind (`held`), `scored` and `pairCap`.
  The owner's list leads with automatic pairs, then the rest, a words-only pair whose second headline pair is weak
  (H2 under 0.1: one shared row carries it) after the others, kept-apart pairs last.
- **Every merge is logged and undoable.** `narrative_merges` keeps the absorbed row whole, the survivor's row before and
  its compared fields after, the moved rows (`narrative_merge_items`) and the counters that pointed at it. Undo restores
  the absorbed row column for column, moves back exactly its rows (rows that joined since stay and are counted), restores
  the survivor's terms, counts, entities, first row, working title and alert (an inherited alert goes back, one sent
  after the merge stays), its centroid (verbatim while nothing moved it; rebuilt exactly from the logged weights while
  every later merge moved it in turn with nothing between; un-mixed by counts while the survivor is young; else left
  as it is, and once an undo left it, every later undo leaves it too and says so), and its naming state as a whole only
  when no person has edited it since: a later person merge's carry of a name or a pin is no edit and is replayed on the
  pre-merge state (review: the first build read it as an edit, so undoing the earlier merge first left another
  narrative's person label on the survivor). Later merges' records are rebased, so merges into one survivor undo in
  either order. Every undo writes a keep-apart, as does a
  person's `POST /narratives/merges {keep}`: the pair is listed last and never merged by the pass until a person lifts it
  (`unkeep`); every active keep is read (no cap drops one), and an hourly sweep retires a keep whose narrative is gone
  for good (`undone_by` `retired`). A person's merge carries an edited narrative's name, issues and namespace to the survivor; the pass never
  touches an edited, pinned or muted narrative. An absorbed id keeps resolving (`/narratives/one` answers the survivor
  with `mergedFrom`; `/update` and `/merge` answer 409 `merged`; Studio's narrative source and `/den/board`'s additive
  `aliases` follow it); at filing, a brief's cite of an absorbed narrative covers the survivor's signal only when every
  merge in the chain was a person's, and an automatic one is named in the 409 for the person to judge.
- **Routes (full key).** `GET /narratives/merges` (stored), `?dry=1` (computed now, nothing written), `?dry=1&pairs=a:b`
  (features, the pre-filter and verdicts for listed pairs, the calibration instrument), `?log=1` (merges and keeps),
  `&modes=1` (`narr_mode_log`); `POST /narratives/merges {apply}|{undo}|{keep}|{unkeep}|{mode}`; `GET/POST
  /narratives/near`. `POST /narratives/merge {into, from}` keeps its body and answer and now logs. `POST /narratives/update`
  records `person_ts` and `person_by`. `/narratives/status.merge` gives the modes and their source, the clause, a pause,
  the last tick's proposal count, holds by kind, pairs scored against the cap, the standing near-born narratives and the
  last day's automatic merges with their undo ids; the run summary names merges with their undo id, the tick prints
  them and records the pass as the `narr merge` stage with its wall time and `{scored, cap, partial}` (a Worker's clock
  stands still in a loop without I/O, so the milliseconds leave the scoring out).

**Defaults and the modes.** `narr_near_mode` and `narr_merge_mode` live in KV, are written only by `POST
/narratives/merges {mode}` with a full key, and every change is logged in `narr_mode_log` with its before and after (it
is undone by posting the previous mode); they override the vars `NARRATIVE_NEAR`, `NARRATIVE_NEAR_LEX`, `NARRATIVE_MERGE`,
`NARRATIVE_MERGE_SIM`, `_FORM`, `_FORM_C`, `_FORM_T`, `_FORM_S`, `_CORR`, `_CROSS_NS`, `_TICK` (documented in
`wrangler.toml`). Without either, nothing new joins or merges: the near mode records and the pass proposes, because no
live centroid or 40-term map has been read and the automatic bars must be set from them. What the defaults still leave
(review): a syndicated batch of one story's headlines placed in one run starts its own narrative beside the story's
(as p68 did; it raises no second alert and the pass proposes it); a late row P1 would have joined stands alone and is
set aside after a day (as p68); a late, weakly worded near miss that P1's evidence does not cover still grows its own
narrative under P2 (the pass proposes it when its words carry it). Near mode `on` takes the first two into the story's
narrative; merge mode `auto` takes what its clause passes.

**Calibration (offline, read-only).** On the 223 labelled pairs of the census the worker's own scorer reproduces the
census scorer's S exactly (largest difference under 0.0001). Over all 44,818 non-borderline pairs of the 300 (truth: the
34 groups; 112 within-group pairs, 96 grouped narratives): S >= 0.25 precision 0.29, pair recall 0.61, member recall 0.82;
S >= 0.35 0.71 / 0.37 / 0.61; S >= 0.45 0.81 / 0.19 / 0.32 (5 false). With every non-score guard of an automatic merge
and c and T assumed to pass (the best case), the first build's S_auto: >= 0.45 11 true, 0 false; >= 0.40 17 true, 1
false; >= 0.35 26 true, 6 false; >= 0.25 39 true, 58 false. That "0 false" held only after the holds: two labelled
different pairs cleared 0.45 with an anchor within 24h, one stopped only by the opposite veto, the other (two press
releases from one MP) only by the clients hold. The review's S_auto (person and party words out, the best pair's own
words out of U and X; the snapshot scored with the default register, so live names drop more): >= 0.45 10 true, 0 false;
>= 0.40 11 true, 0 false; >= 0.35 15 true, 1 false; >= 0.25 34 true, 29 false. With every hold ignored (anchor, 24h, under
60 rows only) >= 0.45 still takes 10 true and no false pair; the highest false pairs sit at 0.44 (held on scope) and
0.439 (held by the opposite veto), the highest with no hold at 0.38. So the form clause keeps 0.45 (0.01 above the
highest false pair with its holds ignored, 0.07 with them; live IDF over up to 600 candidates moves the scores), the
words rule stays at 0.45, the centroid clause's 0.25 is corroboration only and that clause rests on C_HI. On invented
fixtures the live-blog pair (one shared row naming two stories) scores S_auto 0.21-0.24 at three to five rows a side
(0.41-0.47 before, automatic at 3/2 rows) and the sibling sweep's false automatic merge at sibling cosine 0.86-0.87 is
gone. The opposite veto fires on 0 of 46 same pairs that carry claims and a counter, 1 of
43 hard negatives, 1 of 8 borderline. The centroid bars cannot be measured on a snapshot without centroids and come from placement's own: C_HI =
0.92 sits just above `NARR_SIM_STRICT` 0.91, the cosine at which placement joins a row with no shared anchor at all; C_LO
= C_FORM = C_HI - 0.06 = 0.86 sits above `NARR_SIM` 0.84 (centroid cosines run above row cosines: two halves at row
cosine 0.80 reached 0.877) and above the 0.70-0.83 band of unrelated political headlines; the form rule's floor, 0.79,
is P1's near-miss band under 0.84. Every bar is a ranged setting the deploy-day calibration re-reads on live centroids.

**Deploy day (this session's work, the owner's yeses).** The owner deploys (`tools/deploy-worker.sh --dry-run &&
tools/deploy-worker.sh`; no page change); `/engine/status` answers `2026-11-16.studio-p69` and `/narratives/status.merge`
shows `propose` and `shadow` from source `default`. After the first tick the session reads the stored and dry proposals
and the labelled pairs through `?dry=1&pairs=` (read-only), reads the live centroid cosine of every census member whose
outcome depends on it (45 of the 62: 26 proposed only at c >= 0.86, 11 at c >= 0.92, 8 at c >= 0.91 with no anchor)
before anything else, chooses on a grid the clause with the most automatic same pairs and no automatic hard negative,
reads every automatic pair from its rows, and shows the owner two lists: the merges to apply (each undoable) and the
clause with its numbers. On his yes the session posts the apply list and the mode. P1 is not counted as the prevention
for cause 1: on the census's labelled pairs its evidence of the first build (six stored titles) would have let back
about one split-off row in seven, one starter in seven (16 of 107; 20 of 107 with the label), under the one-in-five bar
P1 must clear to stay; the merge pass is what consolidates cause 1. The 40 recent titles the review added cannot be
measured on a snapshot that holds six titles a narrative, so P1 is judged live: it stays in shadow until at least 50
would-joins read 95% the same story with no opposite-claim, live-blog or forum-boilerplate join, and its reach is read
from the shadow log (would-joins and `status.merge.nearBorn.wouldJoin`) against the near-born narratives (`standing`,
`nearBorn` in the pass) - under one in five, P1 is dropped in a later build.

**Tests first.** `tests/narr-merge-worker.mjs` (63 cases at first: P1a-P1j, P2a-P2c, P3a-P3b, P4a, P5a-P5d, M1-M14,
U1-U10, R1-R11, D1-D3, A1-A5), every row invented on neutral stories. On 5fd5573, 59 of the 63 failed, all 28 marked (F)
among them; P1d, P1e, P1f and P3b are guards that already held. The review added thirteen cases and extended three (76
in all: P1k, P2d, P2e, M2b, M15-M19, U7b, U7c, R12, R13; P1h, M13 and A3 extended); on 90078e3, the first build, all 16
failed, each for the defect the review found. One assertion of the first build moved: U7 required a later merge's
rebased record to carry no centroid; it may now carry the one rebuilt from the weights, which is the survivor's own.
The four named harnesses pass unchanged (narratives-worker 18, den-autoname-worker 15, narr-drain-worker 23,
ai-automation-worker 4), as do den-worker 22 and den-release-worker 6.

**Not verified.** Live cosines and term maps (the clause defaults rest on the snapshot's word score and invented rows);
P1's evidence on invented text only (the 40 recent titles on none); the opposite veto needs a model claim on both sides;
the scan's cost on synthetic data only (in Node, 600 narratives with 768-d centroids: about 18,000 pairs on ten issues
in 0.3 s; on one issue the tick's 80,000-pair cap in 0.5 s with random centroids, 1.3 s of CPU when every pair is close
enough to need its headline scores, under the emulated Worker clock as under the real one; on the 16 November snapshot
about 23% of pairs share a leading issue or entity within 96h, so about 41,000 at 600 candidates). There is no time budget inside the scan: a
Worker's clock does not move in a loop without I/O, so the bound is the pairs cap and `tick_last` records the pairs
scored, not the loop's CPU. D1's JSON functions inside a batch (`json_group_array`, `json_patch`, `json_remove`,
`json_each`) and the recursive keep-apart read are checked in SQLite only - the first live merge confirms them. Places that
differ from the written design: an alert is captured by a compare-and-set on the alert values instead of a subquery (an
alert between the read and the batch makes the batch a no-op and the merge reads again); P1 records the near misses
that did not qualify as well (`miss`), so the calibration sees both sides; a pair the pre-filter of the scan skips (S
could not reach any bar even with H = 1) is not scored for the automatic clause either, which only ever withholds an
automatic merge.

**Review (16 November 2026, same build `2026-11-16.studio-p69`, not deployed).** Three reviews (data safety, matching,
cost) of the first build found five data-safety defects, six matching ones and four of cost; each is fixed above or
listed here. Left, with the reason: development chains (three days of one story at c 0.85) are still not proposed,
because widening the proposal net at 0.84 lists as many sibling pairs as true ones on invented fixtures; the bar moves
with `NARRATIVE_MERGE_SIM` (C_LO = C_HI - 0.06) once live cosines are read. At the defaults all 62 census duplicates stay
split by design; the default rules list 16 of them whatever the live centroids are, and under the first build's score
the automatic clause could reach 8 to 26 depending on them (the review's S_auto passes one same pair fewer at 0.45 on
the snapshot). The member-held and cap-held pairs are counted apart in `narr_merge_last.held`, so the cost of complete
link and the day caps is visible.

**Asked for and not built.** The page: a proposals panel with Apply, Keep apart and Undo, "merged from" in the drawer, the
near log, and the Brief pane reading `aliases`. Open for the owner: automatic merges across clients (`crossNs`, built,
off), claim-level merges over separate events (a later build), where the labelled pairs are kept, merge-row retention
(kept for good: about 20 KB a merge), case-sensitive acronyms.

**Deployed, the first live run, and automatic merging (16 November 2026).** The owner deployed p69 at 15:45 UTC
(revision 6bf6b1b, deploy token `72a3e4b627773fa6`); `/engine/status` answered `2026-11-16.studio-p69` after three reads
while Cloudflare switched versions. The first dry run (`GET /narratives/merges?dry=1`) considered 379 narratives, scored
17,956 pairs in 2.3 s and proposed 74 (words 31, centroid and words 28, form 8, centroid 7; holds: clients 17, scope 6,
opposite 1), 5 of them automatic. Three independent readers (an editor, a sceptic and a client view) judged every pair
from its rows: 47 the same story, 26 different, 1 split. The wrong proposals came mostly from large, diffuse narratives
whose centroids sit near everything (centroid 0.92 to 0.93 with word scores of 0.13 to 0.18); none of them was
automatic, and all 5 automatic pairs were judged the same story by all three readers. On the owner's yes, at 16:15 UTC:
42 merges (37 within a client; 5 moving unassigned or general rows onto the client board the story belongs to) and 25
keep-aparts (the pairs all three readers judged different); one cross-client move and the split pair were held back.
Narratives went from 3,101 to 3,059; every merge is logged and undoable, an absorbed id answers with its survivor
(checked), and D1's JSON functions inside a batch ran in all 42 merges without an error. A fresh dry run listed 26
proposals: the 22 kept pairs last, and 4 open, one of them new because a merged centroid moved. At 17:15 UTC, on the
owner's instruction, the merge mode was set to `auto` (`POST /narratives/merges {mode: {merge: 'auto'}}`, KV, logged in
`narr_mode_log`): the automatic clause at its defaults, never across clients, 5 a tick and 40 a day, paused after three
undos in a day; near mode stays `shadow`. `{mode: {merge: 'propose'}}` goes back. No pair qualified at the switch, so the
first automatic merges come from new duplicates. The readers' notes and the plan are client-confidential and kept out of
the repository. Not verified yet: the automatic merges themselves, and near mode's reach from its shadow log.

### 10.12 Weekly desks and their morning draft (build p70)

Branch `claude/den-weekly-desk`, cut from `main` at 26d3753 (the live p69). The owner asked on 16 November 2026 that the
analyst can keep daily reports as well as the weekly ones. A desk's cadence (Options, Daily or Weekly) changed one word
of the draft's prompt and the page's label, nothing else: `denBriefCron` drafted every desk with `auto_draft` set every
morning, so a weekly desk was drafted seven times a week, like a daily one. Now a daily desk is drafted every morning
exactly as before, and a weekly desk only on its report day: the Sydney weekday in `options.weekday` (0 Sunday to 6
Saturday), Monday when it has none, read from the Sydney day of the window's end, so 8am on a Wednesday in Sydney is
Wednesday while UTC still says Tuesday; the cron's answer names each weekly desk it left in `waiting`
(`mca_au: Monday`). `POST /den/desk/update {id, patch: {options: {weekday: 3}}}` (full key) saves the day as a whole
number 0-6 (the one digit as text, as a select sends it, is read the same); any other value is dropped and the saved day
stands, and the Options editor's own save keeps it. The cadence does not set the window: a weekly desk wants a reporting
window of 168 hours. A report day the morning window misses (automated model work off that day, the day's Den calls
spent) is not made up later in the week; that week's brief is drafted by hand from the Brief tab. No page change:
Options has no report-day control yet, so a day other than Monday is set through the route, and its wording still says
one model call a morning. Tests first: `tests/den-weekly-worker.mjs` (3: DW1 to DW3, on a clock set to named Sydney
mornings), all three failing on 26d3753; `tests/den-worker.mjs` (22), `den-release-worker` (6) and
`ai-automation-worker` (4) pass unchanged, as does `node tests/run.mjs check` (30). The owner's steps: deploy p70
(`tools/deploy-worker.sh --dry-run && tools/deploy-worker.sh`; no page change), confirm `/engine/status` answers
`2026-11-17.studio-p70`, then on each weekly desk set Cadence Weekly, Reporting window 168 and Draft each morning Yes in
Options, and post the report day if it is not Monday. Not verified: the live cron on a real desk; the first report-day
morning of a weekly desk after the deploy shows it.
