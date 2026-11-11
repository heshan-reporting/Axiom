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
