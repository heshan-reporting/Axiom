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

