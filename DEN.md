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
on the Mac, having read the warning. Platforms the owner has switched on so far: none recorded.

**What agent-reach can do, and so what this layer can do.** Read from its documentation and channel source on
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

Harnesses: `tests/den-worker.mjs` (17), `tests/den-browser.mjs` (24), `tests/den-inject-browser.mjs` (60),
`tests/den-tools-test.py` (54). Screenshots of each tab at 1366 x 768 and 1920 x 1080: `node --experimental-sqlite
tests/den-shots.mjs` (into the ignored `tests/shots/den/`); they were looked at.

**Not verifiable here.** No draft has been written by a real model: the stub writes from the evidence it is sent, so
the quality of a real draft - whether it reads like her reports - is unknown until the first one on the live worker
(one call). No live archive was read, so the board has only been seen on invented rows. Clipboard paste into a real
Google Doc was not tried (the clipboard holds HTML and plain text; what Docs makes of it is Docs').

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
| Every layer 2 channel against its live site, above all which fields carry the counts | No platform was contacted and nothing was signed in to | `reach_social.py <channel> --dry-run --out` on the Mac |
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


## 8. Release 7 - public-record routes (build `2026-11-11.studio-p59`, page `den.js?v=r45`)

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
| Seeds | 29 sources (release wire, court lists, Treasury's FOI log, NOPSEMA decisions, campaign and member pages of both sides, trade and community press), 5 watched parliament pages, 6 petition counters, 9 organisations in the entity register | worker |

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
- **Three of the five pages named for seeding are not seeded**: the Mount Pleasant Mine Bill, the Tasmanian firearms
  bill and the ACT firearms bill. The research had no page address for them. Add each with `POST /den/process/add` or
  in Sources once its address is known. Seeded: the gas reservation inquiry and bill, the NSW firearms inquiry, the NSW
  disallowance alerts, the Victorian firearms bill.
- **"Once a sitting day" is once a Sydney day.** There is no sitting calendar in the worker; on a non-sitting day the
  sweep finds nothing new and files nothing.
- **Campaign names are proposed by a step a person presses**, not by the release itself: proposing them automatically
  gave three desks a register of their own accord, which changed when keyword discovery runs.
- **The stricter rules apply to the new routes only.** Sources that were already seeded keep their existing methods
  (`html`, `rss`, `gnews`) and the existing fetch. Moving one to the public reader is a change of its `urls.public`.
- **No page was built for adding a watched bill or a counter.** Both are routes; the Sources drawer shows the sources.
- **The ten-second pace is kept per worker isolate**, the only memory a Worker has between requests without a write
  to KV on every fetch. Two isolates could each make a request to one host inside ten seconds. Each source also runs
  on its own schedule (a watched parliament page every six hours), which is the wider spacing.

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

Then: Sources, Untried, Sweep (the 29 sources and 5 parliament pages); `POST /den/watch/seed` and approve what is
wanted in Watch; add the three missing bills once their addresses are known.
