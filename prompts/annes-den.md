# Claude Code prompt: the activist monitoring desk - wider collection, keyword discovery, and Anne's Den (after P52: worker p52, page `?v=r39`)

Paste everything below the line into Claude Code, opened at the root of the `Axiom` repository.

---

You are working in the AXIOM repository. Read `CLAUDE.md` first: it is the system map and its rules apply. For this work
the sections that matter are The Sentinel, The Source Registry and full text, Social and community capture, Signals,
Sentiment, Narratives, The daily brief, Meta direct, Campaign performance (the Supermetrics path), Access roles,
Reliability and Automated model spend. Then read `prompts/studio-engines-and-canvas.md` for how a release is run here.

## The goal

The owner asked for this, in their words (spelling tidied): "try this and let's try to get Facebook and Instagram collection more widen
regarding her keywords and find new relevant keywords as well.. once that is done, create a different page named Anne's
Den and create a workspace for her accordingly.. So her work can be easier. Add features and make the UI very production
grade with options and make it bug free and reliable."

"Try this" refers to two builds already offered to the owner: (1) add the topics and sources her reports cover and AXIOM
does not, and (2) a per-client activist brief in her own format with every claim cited.

Read that as five outcomes, in this order. Each is a release of its own.
1. **Coverage.** AXIOM collects what her reports are made of: the topics, the outlets and the actors.
2. **Facebook and Instagram.** Public posts by the organisations and officials she watches, and public posts on her
   hashtags, arrive in the archive with their interaction counts, through routes the platforms permit.
3. **Keyword discovery.** AXIOM proposes new terms, hashtags, accounts and outlets with the evidence for each, and a
   person approves them. Nothing is added by a machine alone.
4. **Anne's Den.** One page where her day's evidence is already sorted into her sections, a cited draft is one stated
   call away, and the report leaves in the shape she files it.
5. **Reliability.** Every state designed, every failure named, every figure traceable to a row.

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
sites. About half of her evidence is social, and Facebook and Instagram together are the second largest channel.

What she has said about her tools: the media monitoring service returns irrelevant results (how-to reels, unrelated
topics) and she curates by hand; a client's feedback on the output was that it reads as generic and missed a critical
event (a campaign launch by independents) in the week it happened. The standard for this work is therefore **relevance
and nothing critical missed**, before volume.

What AXIOM does not yet do for her (found by reading the worker, not the live archive):
- The `aep` lexicon has `gas` and `energy` only. None of these appear anywhere in the worker: windfall tax, gas export
  tax, super-profits tax, PRRT, COP31, data centres, Scott Reef, Browse.
- The Point (`thepoint.com.au`) is not a source. The Australian Marine Conservation Society and several of the Greens
  senators and MPs she cites are not in the entity register.
- Facebook and Instagram public pages: `socialCoverage()` says `facebook_public` has no method. Instagram has none either.
- X keyword search runs only on the Mac collector; account timelines run in the worker for the MP register plus KV
  `x_watch`, which holds none of her actors.
- `briefWrite()` is one cross-client brief in AXIOM's shape, not a per-client, per-region brief in hers.

## Decisions the owner has to make (proceed on the default; list each in the report)

- **D1 Naming public actors.** Today no name is stored on a social row except a sitting MP on their own post
  (`meta.mp`). Her reports name organisations and officials, because who said it is the point. Default: extend the
  exception to **registered public actors on their own posts only** - an organisation's official account, or an elected
  official - as `meta.actor {id, name, kind}`, where `id` is a watch-register row. Individual campaigners, commenters,
  repliers and anyone not in the register stay anonymous, as now. Write the rule into `CLAUDE.md`.
- **D2 Live reads through the Supermetrics connector.** Default: at most **eight** queries against public pages, to
  capture real response shapes for fixtures and to prove the path. No client account data. Each one named in the report.
- **D3 The scheduled route.** Default: build the manual route (below) fully, and build the worker-side route behind
  configuration that is absent today, with a probe that says what to set. Do not ask for or handle any credential.
- **D4 Model spend.** Default: a brief draft is one model call per desk per window, started by a person, its cost stated
  on the button, counted in the `ai_usage` ledger under scope `den` against `DEN_DAILY_CALLS` (default 20). Drafting each
  morning without a person is a per-desk option, **off** by default, and held by `AI_AUTOMATION` like every other
  scheduled model call.
- **D5 Getting the report out.** Default: Copy as rich text (pastes into her Google Doc with headings and links),
  Download `.md` and `.html`, and Copy the Slack summary. Writing to Google Docs from the worker is not built.
- **D6 Who can use it.** Default: reading the Den is read role; drafting, approving a watch item and saving a brief are
  full, through `axRoutePolicy` as it stands. Her key is a roster entry the owner adds.

## Rules for this work

- **Test first.** Every defect gets a test that fails on the current commit and passes after the fix. Every capability
  gets acceptance tests: worker cases in `tests/den-worker.mjs` and `tests/den-collect-worker.mjs` (on
  `tests/worker-env.mjs`), browser cases in `tests/den-browser.mjs`, tool cases in `tests/den-tools-test.py`.
- **Providers mocked only.** Make no paid Claude or Gemini call, contact no live worker, and run nothing in `tools/` that
  spends. D2 is the one stated exception. Where a change needs the live archive or a real model to judge it, write the
  evaluation and leave the run to the owner with its estimated cost.
- **Permitted routes only.** No scraping of Facebook or Instagram pages, no logged-in browser automation, no private or
  mobile endpoints, no third-party scrapers. If a thing cannot be reached through a route the platform offers, the
  coverage table says so in a sentence. A platform's stated limit is tracked and respected, never worked around.
- **Her reports are client material.** They are read through the Drive connector in the session and never copied into
  the repository: not as fixtures, not as examples, not in a commit message. Derived **public** facts (a topic term, an
  organisation's name, an outlet's address) may enter the lexicon and the seeds. Fixtures use the synthetic client
  (`synthdemo`, Harbourline Ferries) with invented groups and posts.
- **Client walls.** A desk belongs to one client namespace. Its watch register, mutes, rules, briefs and retrieval never
  reach another desk's. An organisation watched for two clients is two rows.
- **Names.** D1 and nothing wider. A test proves a commenter, a replier and an unregistered account are stored without
  a name or handle on every new path.
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
   that Phases 1 to 3 close. Write it into `DEN.md` (repository root, not `docs/`) as counts and public names only.
5. Read what the Supermetrics connector offers before designing Phase 2: `data_source_discovery` and `field_discovery`
   for `FBPD`, `IGPD2` and `MAL`. Known at the time of writing:
   - `FBPD` (Facebook Public Data, no sign-in needed): `PagePosts` for a page alias (message, permalink, created time,
     reactions by type, comment and share counts), `Page` (followers, category, verified), `UrlShares` (Facebook
     reactions, comments and shares for any URL). No keyword search and no comment text.
   - `IGPD2` (Instagram Public Data, signed in): `BusinessDiscoveryMedia` for a username (caption, permalink, likes,
     comments, reels views, timestamp), `BusinessDiscoveryAccount`, and `HashtagSearchMedia` (recent or top posts for a
     hashtag: caption, permalink, likes, comments). No comment text.
   - `MAL` (Meta Ad Library): not signed in. The worker's own `metaAdLibrary()` needs `META_USER_TOKEN`.
   Confirm each against the live discovery answer and record what differs.

## Phase 1 - Coverage: topics, outlets, actors (release 1)

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
4. **Entities.** Add the missing organisations and elected officials to `ENTITY_SEED` with `side` and `ns` set, aliases
   that are plain words, and no bare surname that is also a word.
5. **Actors on X.** The actors with an X account become proposals for the watch register (Phase 3), not a hard-coded
   list.
6. **Tests.** A table of real-shaped sentences per new issue: must tag, must not tag, must trigger the Sentinel, must
   not. The mirror test proves `AX_ISSUES` matches the worker. `GET /reddit/issues` publishes the new ids.

## Phase 2 - Facebook and Instagram, widened through permitted routes (release 2)

**The watch register** (D1 `den_watch`): `id, ns, kind account|hashtag|term|source, platform, value, name, actor_kind
org|official|media, issue, status proposed|active|off|dismissed, source operator|reports|discovery|seed, evidence json,
score, added_by, decided_by, decided_at, reason, last_ok, last_error, updated`. Unique on `(ns, kind, platform, value)`.
Routes: `GET /den/watch?ns=&kind=&status=`, `POST /den/watch/add|update|decide|delete`. Every decision records who and
why.

**Route A - the session pull (works on day one).** The pattern the Audience view already uses:
1. `tools/den-pull-plan.py --ns aep --key ... ` prints the queries to run for the active register rows (page aliases,
   usernames, hashtags, the day's top news URLs), within the limits below. With no key it reads a register export file.
2. The queries run through the Supermetrics connector in a Claude Code session and their results are saved as files.
3. `tools/supermetrics2signals.py fbposts=<file> igposts=<file> ighash=<file> urlshares=<file> --ns aep` converts them
   to archive rows in the Signals shape: kind `sig_thread`, `meta.platform` `facebook` or `instagram`, `url` the
   permalink, `meta.eng {likes, comments, shares, views, reactions:{love, wow, haha, sad, angry}}`, `meta.eng_at`,
   `meta.issues` from the live lexicon (`GET /reddit/issues`, as `reach-reddit.py` does), `meta.via: supermetrics`,
   `meta.watch` the register id, and `meta.actor` under D1 only.
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
  probe, and state in the coverage table that until that permission exists Facebook arrives by Route A.
- `metaAdLibrary()` searches the active terms of every desk as well as the issue labels.
- `GET /meta/status?probe=1` grows the three new steps and names the first that fails. `socialCoverage()` gains honest
  rows for `facebook_public` and `instagram_public`: how, what it needs, what it cannot reach, how the last run fared.
- Cron: inside `socialCron()`'s cadence, by cursor, never more than the per-run cap. No model call.

**For both routes.**
- **Counts move.** A post read again updates `meta.eng` in place (`json_set`) and appends one daily snapshot row, as
  petitions do, so the Den can show growth and a report can quote the count with the time it was read.
- **Relevance.** A post from a registered account is kept only if `issueTag()` finds one of the desk's issues or an
  active term in it; the rest are counted, not filed. A hashtag hit passes the Australian gate with the hashtag itself
  struck out of the text first, as `bskySweep` does.
- **Facebook reach of the news.** `UrlShares` for the day's top issue-tagged news rows writes `meta.fb {reactions,
  comments, shares, at}` on the news row, so she can see which stories are travelling on Facebook.
- **What stays out of reach,** stated in the table and in the Den: comment text on other organisations' posts, groups,
  personal profiles, stories, and keyword search across Facebook.
- **Signals** gains Facebook and Instagram tabs built from the existing components.
- **Tests.** The converter on recorded-shape fixtures (synthetic content); dedupe on re-run; the count update and
  snapshot; the relevance filter; the hashtag ledger refusing the thirty-first; D1 names proven absent for unregistered
  accounts; the probe naming each missing setting; a refused or malformed provider answer filed as a failure, never as
  an empty success.

## Phase 3 - Keyword discovery: proposed with evidence, approved by a person (release 3)

`denDiscover(env, ns, {days})` is deterministic and makes no model call. It proposes register rows with status
`proposed`, each with evidence (up to five archive items and the phrase in context) and a score:
1. **Terms**: phrases of one to three words that are over-represented in rows tagged with the desk's issues against the
   same desk's fourteen-day background (a lift measure with a minimum count; stop words and the existing lexicon out).
2. **Hashtags** on registered accounts' posts and on issue-tagged posts.
3. **Accounts** that registered accounts repeatedly mention, repost or link to.
4. **Outlets**: domains linked from issue-tagged rows that are not in the Source Registry.
5. **From narratives**: the top terms of live narratives on the desk's issues that the lexicon does not match.
6. **From her reports**: `tools/den-mine-reports.py <folder outside the repository>` reads exported reports, extracts
   terms, handles and domains, and posts them to `POST /den/watch/propose` with source `reports`. It prints what it
   would send and sends nothing without `--apply`.

Before a decision, **Preview** shows what a term would have caught: the last seven days of archive rows it matches that
no current issue tags, with a sample of twenty and a count by channel - a query on what is already held, free. A term
whose sample is mostly foreign or off-topic is visibly so before anyone approves it.

An approved term widens **collection and tagging only**: it joins the desk's search terms and its wide matcher through
one function (`deskLexicon(env, ns)`, cached, merged into what `GET /reddit/issues` publishes so the desktop collectors
cannot drift). It never changes a tight `rx`; the Sentinel's triggers stay hand-written. Guards: a cap of active terms
per desk, a generic-word warning from the Australian gate, an off switch per term, and a 30-day review line for terms
that have matched nothing.

One optional model step, behind a button with its cost: group the proposals into themes and say in a line why each
might matter to this client. It changes no status.

Tests: each of the six proposers on seeded rows; the preview query; an approved term changing the published lexicon and
the tagging of a new row; a dismissed term never proposed again; another desk's proposals never visible; the tool's dry
run sending nothing.

## Phase 4 - Anne's Den (release 4)

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
  outlets, Facebook reach where held, full text on demand.
- **Social**: posts from the register and on the terms, by channel, with interaction counts, the time they were read
  and growth since the last read.
- **Influencer and political**: registered officials and organisations, and MPs from the register, on their own posts.
- **Upcoming**: dated actions (protests, hearings, launches, petitions closing) found by a deterministic date-and-verb
  pass over the window's rows, each with its source row; never a guess presented as a date.
Each row can be **pinned** to the report, **set aside** with a reason (not relevant, duplicate, foreign), or opened at
its evidence. Set-asides are per desk and feed mutes: after three set-asides of the same account, domain or term the
Den offers a mute, which a person confirms.

**Nothing critical missed.** A strip above the board, computed without a model: Sentinel spikes on the desk's issues;
narratives that became `emerging` in the window; **first-seen actors** (a register entity or a new account with its
first issue-tagged post in fourteen days); terms bursting against their own baseline; a registered account whose
engagement on one post is several times its median. Each line opens its evidence. Before a brief is marked filed, the
Den lists the items on this strip that the brief does not cite, and asks once.

**The brief.** `POST /den/brief {desk, window, pins}` (full) writes a draft in her seven sections from the evidence,
in which every row carries an id. Strict JSON; one retry on invalid JSON, none on a budget or account refusal. A
`denClean()` like `briefClean()` ties it back: an id the evidence never gave is dropped with its sentence marked
`uncited`, counts and names come from the data and never from the model, the Source List is built from the cited rows
in her format, and the posture is one of the desk's own vocabulary. The call must survive its own length: a job the
worker runs after a response lives about thirty seconds, so use the in-request heartbeat or a stepped job, and say
which and why. The system prompt ends with `AX_UNTRUSTED_RULE`.
Briefs are D1 `den_briefs` (`desk, day, window, status draft|filed, revision, sections json, evidence json, model,
by, filed_by, filed_at`), with every save a row in `den_brief_revisions`. In the page: an editor per section with the
citations as chips that open the row; **Regenerate this section** (one call, stated) that never touches a section a
person has edited unless they ask; hand edits autosaved for this person (the Studio's working-copy pattern, never a
silent overwrite: a stale revision is a 409 with Keep mine / Take theirs); **Mark as filed**; history with a
word-level difference against yesterday's filed brief; and D5's exports. Retrieval for the draft is the desk's
namespace and `cmm` only.

**Watch.** The register and Phase 3's proposals: tabs for terms, hashtags, accounts and outlets; the proposal queue
with evidence, Preview, Approve and Dismiss with a reason; health per row (last read, last error); the hashtag
allowance; mutes.

**Coverage.** For this desk: each channel, how it is read, when it last delivered, what failed and why, what cannot be
reached - `socialCoverage()` narrowed to the desk - and **recall against her own sources**: of the links in her filed
reports for a period, the share AXIOM held at the time, by channel, with the misses listed. The measuring tool is
`tools/den-backtest.py <reports folder> --key ...` (read role, dry by nature); the Den shows its last result. This is
the number that says whether the work succeeded, and the owner runs it.

**Options** (per desk, saved with a revision): reporting window and cadence, region, section order and which sections
show, the posture vocabulary, minimum engagement per channel, how syndicated copies fold, mutes, the automatic morning
draft (D4), and the table density. Australian Eastern time throughout.

**Quality of the interface.** Loading, empty, error, partial and read-only states are designed for every panel, and an
empty panel says why (nothing collected, nothing matched, not configured) with the one action that fixes it. Every
paid button states its cost. Keyboard: move between sections, pin, set aside, open, and a shortcuts sheet. Every
control named for a screen reader; the view joins `tests/studio-a11y-browser.mjs`'s gate at 1366, 1440 and 1920. A
read-only key sees everything and no control that writes. A failure in one panel never blanks the page.

**Routes** (GET read, POST full; every refusal has words in `AX_ERROR_DETAIL`): `GET /den/desks`, `/den/board?desk=
&window=`, `/den/missed?desk=`, `/den/brief?desk=&day=`, `/den/briefs?desk=`, `/den/coverage?desk=`; `POST
/den/desk/update`, `/den/pin`, `/den/aside`, `/den/mute`, `/den/brief`, `/den/brief/section`, `/den/brief/save`,
`/den/brief/file`. Lists sent to D1 stay under its hundred-variable limit; stored JSON goes through `jsonFit` or is
refused past its limit with the field named; writes are compare-and-swap on `revision`.

**Tests.** Worker: the board's sorting and folding; region and window edges across a Sydney midnight and a daylight
saving change; the missed strip's five signals; `denClean` dropping an invented id and rebuilding the Source List; a
subverted model answer leaving names, counts and walls intact; one desk never reading another's pins, mutes, briefs or
register; the 409 on a stale save; a budget refusal reaching no provider; the route policy for no key, a wrong key, a
read key and a full key. Browser: the whole day's journey - open a desk, read the strip, pin and set aside, draft,
edit, regenerate one section, see the uncited warning, mark filed, copy and download - plus read-only, each empty and
error state, a dropped connection mid-draft, and reload with unsaved edits.

## Phase 5 - Proof and hand-over

1. The full gate, twice from a clean checkout if a harness was flaky. Fix the harness or the code; never mark a
   failure as known.
2. An error-injection pass on the Den: every route failing, slow, and answering malformed, one at a time.
3. Screenshots of each Den tab at 1366 x 768 and 1920 x 1080 into the ignored `tests/shots/den/`, and look at them.
4. Documents: a section in `CLAUDE.md` for the Den, the watch register, the two collection routes and D1's rule;
   `DEN.md` with the design, the gap list, the platform limits with their sources and the decisions taken;
   `ATTRIBUTION.md` if anything open-licensed was added.
5. A one-page guide for Anne (a Claude Doc, not a repository file): what each tab is for, her morning in six steps,
   what a citation chip means, what the Den cannot see and where she still has to look.
6. The owner's steps, as exact commands: deploy; the first source sweep and which seeds to check; the first Route A
   pull; `tools/den-mine-reports.py` and `tools/den-backtest.py` with their flags; the settings Route B needs
   (`META_IG_USER`, the Meta permissions by name), and the roster entry for her key.

## The report at the end of each release

Say plainly: what was built and where; the test counts and the gate result; each decision D1 to D6 and what was done;
every Supermetrics query made under D2; what was **not** verified in this sandbox (the live archive, real provider
answers, the seed addresses, the Meta permissions, recall against her reports) and the command that verifies each; and
anything asked for here that was not built, with the reason. Do not describe a mocked result as a real one.
