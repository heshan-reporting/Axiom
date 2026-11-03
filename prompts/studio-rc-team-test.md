# Claude prompt: AXIOM Creative Studio - a release candidate the whole team can test

How to use: open a new Claude Code session on `heshan-reporting/Axiom` (any `claude/` branch the session is given), use the
most capable model available at its highest effort, and paste Part A below the line. `CLAUDE.md` loads by itself and is the
system's reference manual; Part A says what to do with it. Part B is for people: the team's test round, which starts after
the owner has reviewed the run's branch, deployed the worker and merged the page.

Written on 3 November 2026 by a review of the earlier draft prompt against the repository at `main` = `062251f` (worker
build `2026-11-06.studio-p44`, page `?v=r28`), with six roles reading the code in parallel: QA engineering, full-stack
engineering, UI and UX design, architecture and security, product, and project management. Every finding in A5 cites the
line it was read from; the reviewers reproduced several with the repository's own mocked harnesses. Treat A5 as leads to
verify, not as facts to repeat.

---

# Part A - the prompt

## A0. Your team and the bar

Act as one coordinated senior team: a QA engineering lead, full-stack engineers, a UI and UX designer, a software and
security architect, a product lead and a project manager. When subagents are available, use one per role for independent
review passes (baseline read, ledger review, final diff review); the work itself stays in this session.

The goal is a **release candidate (RC) that everyone at the agency can test on the live page with the synthetic client**,
and the **test pack** they need to do it. The bar is evidence, not adjectives:

- every defect you fix is reproduced first by a test that fails on the base commit, then passes, and stays in the suite;
- every claim in your report points to a command, a test, a screenshot or a file and line;
- anything you could not prove here is listed as "not proven" with what is needed to prove it.

Never write "bug-free", "fast" or "fully secure". Say what was measured.

## A1. Ground truth as of 3 November 2026 (re-verify; do not assume)

- `main` is `062251f`; your local `main` may be stale, so `git fetch` and compare against `origin/main`.
- Worker: `AXIOM_BUILD = '2026-11-06.studio-p44'` (`axiomworkerv4.js:7283`). **Merged but not deployed.** The live worker is
  older, so the p44 guest guard, PNG integrity checks and honest retraction are **not live** (`CREATIVE-STUDIO.md` s.52.3).
- Page: `?v=r28` is **live** on GitHub Pages (concept C, `CREATIVE-STUDIO.md` s.53): seven stages - Brief, Message
  (Objectives, Strategy), Direction, Copy, Design, Review, Deliver - a reference-style Design editor (rail with Add, Add item
  flyout, format switcher, Style panel in `docs/studio-style.js`, version strip) and a percentage on every wait (counted, or a
  labelled estimate; `docs/studio-progress.js`).
- So **`TESTING.md` gate 5 ("worker and page deployed together") fails today**, and `TESTING.md` lines 5 and 19 describe p44
  as live. The page never checks which worker build it is talking to.
- There is **no `AGENTS.md`**. Read `CLAUDE.md` (Creative Studio sections, Access roles, Reliability, Working conventions),
  `CREATIVE-STUDIO.md` s.46-53, `TESTING.md`, `RELIABILITY.md`, `tests/README.md`.
- The advisor is called the **Creative Director** (Review / Explore / Conversation). Its verdicts are ship / fix / redo, with
  `stop` after two applied corrections, "round n of 2", and "composed tile" or "imagery only". There is no
  "ship/round/composition" status.
- Models are configured, not chosen here: Claude through `CREATIVE_MODEL` and `EXTRACT_MODEL`, images through the worker's
  `ST_IMAGE_CHAIN` with fallbacks. **Do not change a model identifier or request format** without live evidence the owner
  provides (`GET /studio/models`, the `studio_dispatch` ledger).
- There is **no web-search integration** for briefs. "Agent Reach" in this repo is the Mac-side Reddit and X collector
  (`tools/reach-*.py`); `/research` is a separate paid agent the Studio does not call. Build none.
- Tests: `node tests/run.mjs check|backend|browser|all` (`npm test`, `npm run test:release`); 157 of 157 pass locally with
  providers mocked, Chromium only. CI (`.github/workflows/ci.yml`) also runs Firefox and WebKit on every push. The axe
  sweep `tests/studio-s27-sweep.mjs` is **not** part of `npm test` and always exits 0.
- Synthetic client: "Harbourline Ferries - SYNTHETIC DEMO CLIENT", namespace `synthdemo`, seeded by
  `tools/studio-test-kit.py`. Its campaigns mirror MCA and HOOF: `harbour` carries the client logo, `nightboat` its own
  wordmark only. **It cannot be selected in the Studio today** (see R3).

## A2. Rules (non-negotiable)

- Work on your `claude/` branch. One commit per slice, holding the failing test and the fix together; the message names the
  ledger id, has no model identifiers, and ends with the session's attribution lines. Push after each green slice.
- **Never** merge to `main` (that publishes the page to everyone), deploy the worker, call a live model or image provider,
  run `tools/studio-smoke.py`, `tools/studio-demo.py`, `tools/studio-showcase.py` or `tools/studio-golden.py` against a
  worker, or touch production data. Use synthetic data and mocked providers only.
- House rules: `axiomworkerv4.js` stays pure ASCII; the `RULES:BEGIN`/`RULES:END` block stays byte-identical in the worker
  and `docs/studio-render.js`; `docs/studio-shell.css` is the one authority for the Studio frame; nothing private goes in
  `docs/` (Pages serves it); bump `?v=rN` in `docs/index.html` on any page change and `AXIOM_BUILD` on any worker change.
- **Worker changes stay backward compatible with the live r28 page**, because the page is already live and the worker ships
  later from the owner's Mac.
- **Owner-only decisions - do not change them, ask instead:** concept C (the chosen design: fix inside it, do not restyle or
  rename stages); labelled estimates on every wait; MCA and HOOF kept apart; a measurement or an AI recommendation is never a
  person's approval, and tests never record approvals in a live client; per-key client scope (D2); trusting browser pixel
  figures (D3).

## A3. Phases, time boxes and stop rules

Finish each phase before the next. Never leave a half-built feature reachable from the interface.

0. **Baseline (about 15%, no edits).** Record branch, `HEAD`, `origin/main`, `AXIOM_BUILD`, `AXIOM_REV`, the page `?v=`, the
   worktree state, `node tests/run.mjs all` (pass / fail / skip counts, skips named), and
   `node --experimental-sqlite tests/studio-s27-sweep.mjs baseline` (every axe row). Note the base commit's CI run
   (`gh run list` if available, otherwise say so). A red baseline not caused by the environment becomes slice 1.
1. **Ledger (about 15%).** Write `CREATIVE-STUDIO.md` s.54: a system map (islands, routes with their `axRoutePolicy`, D1
   tables, R2 prefixes, KV, Vectorize namespaces `<ns>` / `<ns>_creative` / `cmm`, providers, and the boundaries: client,
   campaign, test vs live, guest vs staff vs public, page build vs worker build) and the findings ledger. Each row: id,
   severity (blocker / high / medium / low), file:line, reproduction, user impact, fix, test, status (fixed / not reproduced /
   decision needed / known limit). Start from A5; add what you find.
2. **Fixes (about 50%, at most 12 slices).** Blockers, then highs, then mediums; record lows. Each slice: save the failing
   test output, fix, re-run that harness plus `check` and `backend`, commit, push.
3. **Verify (about 15%).** `npm run test:release`, the enforcing sweep (Q1), each new or changed browser harness three times
   and once with `PW_CPU_THROTTLE=4`; read the CI run for your head commit (all three engines). Before and after screenshots
   of every stage at 1440x900 and 390x844, and of Design with a panel open at 1280x800 and 1024x768.
4. **Hand-over (about 5%).** A9 and A10.

Stop rules: ask before you spend, deploy, merge, delete, or change an owner-only decision. If a defect will not fail in a
test after two honest tries, mark it "not reproduced" with what you tried. If a fix fails three times or needs a design
decision, revert it and mark it "decision needed". Never start a slice on a red branch. At about 70% of your context, start
no new slice and go to Verify.

**Owner questions:** ask once, in one message, near the start (after the baseline), each with options, your recommendation
and a default; then continue on the defaults without waiting:

- D1. Deploy p44 (and this RC's worker, if it changes) before the round? Default: yes, by the owner; until then demote any
  `--full` guest links with `tools/guest-link.py renew <name> --read`.
- D2. Per-key client scope (a guest or roster key limited to named clients)? Default: not in this RC; internal testers only;
  clients see work only through review links.
- D3. Re-measure contrast and ink from the stored PNG in the worker, instead of trusting the browser's figures? Default: not
  in this RC; stated as a known limit.
- D4. Public mode (`AXIOM_PUBLIC`) during the round? Default: off. If the owner keeps it, it must be `read` with an end date.
- D5. Keep the daily brief out of client retrieval in the Studio's analysis and creative paths (K4)? Default: yes.
- D6. The Content Desk's default "remember: auto" (K5)? Default: change it to ask before saving a rule.
- D7. Round dates, the testers, and how many `--full` links.

## A4. The p43 audit items: recheck, do not repeat

Classify each as closed-in-code, deployed, or open, with file:line and its test:

| Item | State on 3 Nov | Evidence | What to do |
|---|---|---|---|
| Guests write live client memory | Closed in code, **not deployed** | `axGuestGuard` `axiomworkerv4.js:13680`, called at `:14539`; `tests/studio-p44-worker.mjs` 13/13 | Re-run the harness; treat as open in production until D1 |
| Malformed image bytes become deliverables | Closed for the **measured** PNG only | `stPngCheck` `:3197`, in validation `:13198` and render/save `:16542` | Open for finished bitmaps and provider bytes: S4 |
| Failed vector deletion leaves knowledge retrievable | Closed, but the filter fails open | `:3643-3667`; the `catch` at `:3675` returns every hit | S3 |
| Guest access scoped to one client | **Open by decision** (D2) | `axGuests` `:13588` has no namespace; reads pass the guard (`:13688`); a read guest key lists and opens another client's project and reads `/mind/docs` | Document precisely in `TESTING.md` (it says "projects"; it is projects, briefs and Mind documents); build only if D2 says so |
| Validation trusts browser pixels | **Partly open by decision** (D3) | `stValidationJudge` `:13100` re-derives geometry, words, type size and lines; contrast, ink, occlusion, subjects and fonts are taken as reported | Known limit unless D3 |

## A5. Findings the review team confirmed (verify each with a failing test first)

Severity is the reviewers' proposal; re-rate with evidence. "Fails today" means the reviewers expect the test to fail on
`062251f`.

**Release and test readiness**

| Id | Sev | Finding | Evidence | Fix and test |
|---|---|---|---|---|
| R3 | blocker | The synthetic client cannot be selected in the Studio: the client list is the page's `CC_CLIENTS` (mca, aep, vicnats, pca, mba); "Add client" makes a random id | `docs/studio.js:35`, `docs/index.html:5648-5688`, `:5882`; `TESTING.md:56` cannot be followed | List every namespace in `ST_TEST_NS` (`axiomworkerv4.js:13654`) for every key, labelled "synthetic test client"; browser test that selects it and opens a seeded project |
| R4 | blocker | The seed makes two brief-only projects, so every Design, Review and Deliver journey costs model calls first | `tools/studio-test-kit.py:37-76` | Extend `seed` (free, through `/studio/direction` and `/studio/asset`): projects parked at Direction, Copy, Design (one tile passing, one blocked) and Review; uneven stored material between `harbour` and `nightboat`; a mandatory mark rule on `nightboat`; one reference per campaign; `--tester NAME`; print the worker build; verify every project comes back `test: true` |
| R1 | high | The page never compares the worker's build with the one it expects, so a stale worker goes unnoticed | `docs/studio.js:4644` shows `status.build` only | A visible banner "worker build X, this page expects Y or later" and a test against an older stub |
| R2 | high | `TESTING.md` is stale (p44 described as live; the gate cites s.51) | `TESTING.md:5`, `:18-19`, `:26` | Rewrite in the test pack (A8) |
| K6 | high | The live tools create **live** client projects and record approvals in them; their choices reach `studio_intel_log` | `tools/studio-demo.py:56, 60, 223, 319-323`; `tools/studio-smoke.py:141`; `axiomworkerv4.js:9612-9614` | Every project a tool creates is `test: true`; a tool test proves it |

**Security and data integrity**

| Id | Sev | Finding | Evidence | Fix and test |
|---|---|---|---|---|
| S2 | high | With `AXIOM_PUBLIC=full`, anonymous writes are refused only under `/studio`, `/brand` and `/engine`; `/mind/ingest`, `/chat`, `/nano` and `/research` still work | `axiomworkerv4.js:14534` | Refuse every anonymous write; keep `STUDIO_PUBLIC_WRITE=1` as the only override; `auth-policy-worker` cases. Add a key-gated posture readout (build, revision, public mode, guard flag names, guest roles - never values) |
| S3 | high | The retraction filter fails open: a D1 error returns withdrawn passages | `axiomworkerv4.js:3673-3675` | Fail closed (drop hits it cannot clear, log it); test with a failing `MIND_DB` |
| S4 | medium | Provider image bytes are filed unchecked and a finished creative exports that bitmap as is, so truncated or non-PNG bytes can become a deliverable | `axiomworkerv4.js:12990`, `:10671` | `stImgSniff` plus `stPngCheck` before filing; a failure is `malformed` and retried within the image policy; a finished export is decoded and size-checked. Stub returning truncated and JPEG bytes. **Fails today** |
| S5 | medium | A measurement can be filed without its PNG; the first right-size PNG saved later is bound to it, even after design approval | `axiomworkerv4.js:13187-13203`, `:16559-16562` | Require the PNG on `/studio/validation`, or refuse to bind after approval unless the report declared its hash. **Fails today** |
| S6 | low | A render job may name any image model; `input.model` heads the chain unchecked | `axiomworkerv4.js:12975` | Allow-list against `ST_IMAGE_CHAIN` |
| S7 | low | Possible XSS surface: 154 `innerHTML` sinks in `docs/index.html` render scraped or AI text; keys sit in `localStorage`; CORS is `*` | `docs/index.html`; `axiomworkerv4.js:97` | Inventory the sinks that render untrusted text in the Studio's path; fix any that do not escape; record the rest |

**Briefing, memory and the creative engine**

| Id | Sev | Finding | Evidence | Fix and test |
|---|---|---|---|---|
| K2 | high | "Produce N as variants" always sends `acknowledge: true`, which skips the "campaign not confirmed" gate; work with no campaign then gets every campaign's facts and the client-logo default (the MCA/HOOF mixing risk) | `docs/studio.js:4183`; the classic path ticks it only on a person's choice (`:1298`); the gate at `axiomworkerv4.js:10351`, `:10537` | Ask for the campaign instead; synthetic client with two campaigns and none set: no job, a question, no client logo on `nightboat`. **Fails today** |
| K1 | high | Campaign inference returns one campaign; the knowledge the model reads carries no campaign or approval label, so the campaign with the most stored material dominates | `axiomworkerv4.js:9486`, `:9359`, `:9463`, `:9418` | Return `campaign: {candidates: [{id, confidence, evidence, why}], ambiguous, question}`; label every passage, fact and decision with its campaign or "client-wide" and its approval state; `ambiguous` when the top two are within 0.2 or the top is under 0.6; never break a tie by volume; nothing applied without a person. Mocks prove the plumbing; judgement quality is an owner-run live check |
| K3 | medium (suspected) | With more than one campaign, an explicit Standalone still blocks copy, and the guided Copy step has no "proceed" tick; a standalone job sees every campaign's facts at first production but client-wide facts on a recheck, so a HOOF fact passes and then flips | `axiomworkerv4.js:10351`, `:9937`, `:3874`, `:10616`, `:8991`; `docs/studio-guided.js:473`; the fixture MCA kit has one campaign (`tests/studio-fixture.mjs:151`) | Reproduce first with a two-campaign fixture. Standalone is an explicit choice that satisfies the gate and scopes to client-wide records only, the same at production and on every recheck |
| K4 | medium | The daily brief (written by a model, covering every client) is filed in `cmm`, and `cmm` is retrieved for every client, the Studio's analysis included | `axiomworkerv4.js:7235`, `:13927`, `:9359` | Per D5: leave `brief_daily` out of the Studio's analysis and creative retrieval; test |
| K5 | medium | The Content Desk's default `remember: 'auto'` turns an instruction the model judges "standing" into an active client rule in the model's words, injected as "outrank taste" | `docs/content.js:286`; `axiomworkerv4.js:4061`, `:3594` | Per D6: propose, a person confirms with a reason; test |
| C1 | medium | Compositional look-alikes are never replanned: a different medium label alone pushes a pair past "close", and REPLAN fires only on similar arguments or a single medium - "one layout with a different background" | `axiomworkerv4.js:9266-9271`, `:10275` | Measure on the composition (zone, coverage, type scale, image region); treat `photo-*` media as one family; one REPLAN; a look-alike still standing is marked, never hidden. **Fails today** with three photo-bottom directions under different labels |

**Interface (several are regressions from r28)**

| Id | Sev | Finding | Evidence | Fix and test |
|---|---|---|---|---|
| U1 | high | At 1180 px and below the Design panel overlay sits **under** the canvas bar: at 1024 and 834 its title and close are covered, at 390 the bar paints over its tiles; Escape does not close it; focus never enters | `docs/studio-shell.css:371` (z 15) vs `:594` (z 25); `docs/studio.js:2798-2800` | Overlay above the bar, visible title and close, Escape closes, focus in and back; browser test at 1024, 834, 390 |
| U2 | high | With any Design panel open at 1181-1340 px the canvas bar wraps to two rows (75 px); the harnesses only measure it with panels closed | `docs/studio-shell.css:594`; `tests/studio-s24-browser.mjs:61-76`; `tests/studio-c-browser.mjs` C2 | One row of 48 px or less from 1024 to 1920 with a selection **and** a panel open; extend S24 U1 and C2 |
| U3 | high | At 1280x800 with a panel open, the readiness badge, the "Measured at..." line and the composition facts print over each other; `.st-comp-info` is restyled four times in the one-authority file | `docs/studio-shell.css:268, 478, 635, 699` | One rule; no overlap at 1280x800, 1366x768, 1440x900 with a panel open |
| U4 | high | Serious axe colour-contrast failure on the live Message stage: the "Set this objective aside" link, full key, every width; not caught because the sweep is not enforcing | `docs/studio-guided.js:333` (`.st-stepbar-acts > .ov-link`) | Fix the contrast; Q1 makes it fail the gate |
| U5 | medium | The Dark / Light / System switch never shows the selected choice (buttons set `aria-checked`, CSS styles `aria-pressed`); light is never in the sweep | `docs/studio.js:496`; `docs/studio-polish.css:38` | Style `aria-checked`; sweep light too |
| U6 | medium | Every movable layer always shows a resize handle and a dotted box, selected or not | `docs/studio.js:3686`; `docs/index.html:1793`; `docs/studio-editor.css:390` | Handles and names on the selection only (hover shows the outline) |
| U7 | medium | Stage heads take 208-306 px at 1366x768 before any work | the stage head in `docs/studio.js` (`StageHead`) | At most about 140 px at 1366x768: working on, what is missing, the one main action and its cost; the rest behind help |
| U8 | medium | At 1100 px and below a finished stage shows only a tick, no number or name; the project subline is clipped with no ellipsis ("Set - I" at 1440) | `docs/studio-shell.css:387`, `:667-668`, `:37-38` | Keep each stage identifiable; ellipsis plus the existing facts popover |
| U9 | low | Wording: "Reviewy" typo; "one image model call" where a render job may send up to four requests; `person_budget_exhausted` explained as the agency's budget, not the tester's own daily cap; "copy partner" beside the Creative Director | `docs/studio.js:2935`, `:684`, `:118`, `:1567` | Fix; one name for one thing |

**Performance and QA infrastructure**

| Id | Sev | Finding | Evidence | Fix and test |
|---|---|---|---|---|
| P1 | medium | Opening a project grows with assets x versions: `stGet` reads every asset serially with up to 60 versions, standing approvals and readiness each (measured: 2x5 = 29 queries, 13 KB; 10x20 = 109, 217 KB; 20x40 = 209, 750 KB); the page reloads the whole project after every job step and most actions (74 call sites, no single-flight) | `axiomworkerv4.js:7565`; `docs/studio.js` `reload()` | Measure first (seed 20 assets x 40 versions: queries, bytes, ms, reloads per job), then load the current version per asset with history and readiness on demand, and make `reload` single-flight. Targets in A6 |
| Q1 | high | The axe sweep is not enforcing and has holes: not in `run.mjs`, always exits 0, checks Brand only at 1366 px and wider, never opens the Add item flyout, the Style panel, the colour picker, the dialogs, the wizard, `review.html` or Report a problem, never light mode | `tests/studio-s27-sweep.mjs`; `tests/run.mjs:26`; `TESTING.md:15` | Add it to `run.mjs`, exit non-zero on a serious or critical finding or an error row, and cover the seven stages, both roles, six widths, dark and light, the panels, dialogs, wizard and `review.html` |
| Q2 | medium | No browser harness signs in with a guest key; the "read-only for a guest link" chip and the guest refusals are worker-tested only; Firefox and WebKit run only the core journey and S26 | `docs/studio.js:4632`; `tests/studio-xbrowser-browser.mjs:21` | Guest-key browser cases (read-only on live work, the test badge, the tester's own cap message); add the concept C editor and Deliver to the cross-engine harness |
| Q3 | low | `run.mjs` counts a SKIP as a pass | `tests/workerd-deploy-test.mjs:17` | Report skips separately; a skipped engine or runtime is "skipped", never "passed" |

Already built - verify, do not rebuild: client accents (`studioTheme`), the stage heads' need and action rows, the canvas
(S13-S20 and the concept C Style panel), three-way merge, op ids and guarded draft discard, job lease, fence and dispatch gate,
streaming, the editable / finished split and the `mark_policy` 409, the context manifest (`stCompileContext`), `stPngCheck`,
real (never hardcoded) Creative Director scores with "not scored" for a missing one.

## A6. What each area must achieve

**Flow and interface (concept C, keep).** Seven stages over the worker's gates, Alt+1..7. Each stage head says what it works
on, what is missing, the one main action and its cost, within about 140 px at 1366x768. Every stage has designed empty,
loading, running, success, timeout, retry and failure states; a failure says what happened, what was kept and what to do
next. The page never moves by itself. From 1024 to 1920, with a selection and with any panel open, the canvas bar is one row
of 48 px or less; the fitted 4:5 artboard is at least 560 px tall at 1440x900 with the inspector open. Below 1180 px a panel
overlays above the bar, closes on Escape and takes and returns focus. At 390, 834, 1024, 1366, 1440 and 1920: no sideways
scroll, no overprinting, no hard clipping. The accent comes from client data only (campaign accent, else palette primary,
else the Studio's cyan, at 4.5:1); dark and light both pass axe.

**Progress (owner decision).** Every wait shows a percentage. Counted where the work is countable ("3 of 5, 60%"); otherwise
an estimate labelled as one ("~42% (estimate from the last 8 runs), about 20 s left"), drawn striped, held under 95% until the
worker reports done, saying when it runs long. Never show an estimate as measured, never show 100% before done.

**Canvas.** One renderer draws the preview, the measurement and the export. Prove select, marquee, move, eight-handle resize
(Shift, Alt), rotate, snap, align, order, group, framing, undo and redo, nudge and typing on the canvas at DPR 1 and 2 and at
Fit, 100% and 200%. Locked layers and rule-held marks never move (409 `locked`, `mark_held`). The downloaded PNG is the
validated PNG (same hash) and matches the canvas at native size.

**Creative Director.** It advises; only a person approves, in Review. A review names the exact version, composed tile or
imagery only, round n of 2, the verdict, the five scores 1-5 (fidelity, hierarchy, readability, relevance, identity) each with
its reason or "not scored", the words read back, and one correction stating Changes / Keeps / Needs / Lands as, with Undo.
Outdated reviews are marked. Suggestions state scope, cost and basis. No generic praise: every observation names a layer, a
word, a measurement or a reference.

**Briefing and client memory.** Campaign is a person's decision; the reading proposes (K1). Lasting memory changes need a
named person, a source and a reason; model output may only propose (K4, K5). Generated or unreviewed material never becomes
client knowledge silently. Test projects file nothing. Show provenance (source, campaign, approval, date) wherever knowledge
is used.

**MCA and HOOF.** HOOF (`mca` / `hoof`) carries only its "HANDS OFF OUR FUEL" wordmark, never the MCA logo; MCA campaigns and
standalone MCA work carry the MCA logo under the kit's policy. Facts, URLs, references, corrections and examples are scoped
by campaign; client-wide records reach both. Myth and fact formats suit both; content stays in scope. A missing mark, URL,
fact or placement rule is a named gap with its remedy (upload, Teach this brand), never invented. Prove it on the synthetic
analogue (`harbour` = MCA, `nightboat` = HOOF) with mocks; the live MCA/HOOF check is the owner's.

**Generation.** Trace `stClaude`, `nanoRender` (`stImagePolicy`), `stRenderJob` and `studio_dispatch`. Name the configured
models in the report; change none. Fix S4, S6, K2 and C1. Never substitute editable for finished, or the reverse, silently;
say which words and marks are baked into a finished bitmap. Handle rate limits, outages, timeouts, cancellation, duplicate
submissions and stale jobs with the existing job model, and prove each with the fixture's provider modes.

**Validation.** Validation reflects the exact version under review (`stCompSig`); stale measurements and approvals are refused.
Fix S5. Keep blocking findings apart from warnings, each with its layer and a remedy. A technical pass is never a client-side
claim alone: say in the report exactly which figures the worker re-derives and which it takes from the browser (D3).

**Performance (measured, not claimed).** Targets at p95, mocked here and on the deployed worker by the owner: open a project
1.5 s or less; switch asset 300 ms or less; edit to paint 50 ms or less; drag and nudge under 100 ms; a job update visible
within 3 s; cold open under 2.5 s; stage transition under 150 ms (`tests/studio-s23-perf-browser.mjs`,
`tests/studio-s20-perf-browser.mjs`). Report before and after for P1.

**External research.** None is configured; say so and add none. Briefs use approved client memory, the AXIOM archive and
Source Registry ("From Axiom") and pages a person supplies (`/studio/source/url`). Keep title, URL, publication and retrieval
dates with each source; mark inference as inference. Never send a brief, private memory, keys or personal data to an external
service.

**Security.** Run `auth-policy-worker`, `studio-p44-worker`, `studio-ready-worker`, `studio-ready2-worker`,
`ai-boundaries-worker` and `access-link-browser`. Fix S2, S3, S6, S7 as found. Prompt-injected material is quoted, never
obeyed (`AX_UNTRUSTED_RULE`); note that no image call carries it. Errors never expose secrets or another client's material.
Make access fixes in one place (`axRoutePolicy`, `axGuestGuard`) with a regression case per route.

## A7. Slices, in order (at most 12)

1. R3 + R4: the synthetic client selectable, and a free, richer seed (blocker for the round).
2. U1 + U2 + U3: panels above the bar, one row with panels open, no overprinting.
3. U4 + Q1: the contrast fix and an enforcing sweep in `run.mjs`.
4. K2: variants ask for the campaign.
5. S2 + S3: anonymous writes refused everywhere; the retraction filter fails closed.
6. S4 + S6: provider and finished bytes checked; the image model allow-listed.
7. S5: no unmeasured PNG bound to a validation or an approval.
8. R1: the build mismatch banner.
9. K1: campaign candidates, ambiguity and labelled knowledge.
10. K3 (reproduce first), K6, and K4 / K5 per D5 and D6.
11. C1 and P1 (measure first).
12. U5-U9, Q2, Q3, S7 as time allows.

## A8. The test pack (the owner's main deliverable)

- **`TESTING.md`** rewritten for this RC: the build and page, the gate (pointing at s.54), the owner's release steps,
  roles and links, the journeys from Part B with the expected result and the worst-case cost against the tester's daily
  allowance, the known limits (D2, D3 and anything deferred), and the report template.
- **The seed** (R3, R4) and two pasteable synthetic briefs: one ambiguous between the two campaigns, and one with an
  off-topic paragraph and the pending "99 crossings" figure.
- **The report template** (Help, Report a problem): journey and step, role, page release and worker build, project and
  version, severity, expected, actual, how often it happens, screenshot, Sydney time.
- **Evidence**: `tests/shots/` is ignored by git, so publish the before and after screenshots and the sweep summary as a
  private page if the session has the Artifact tool; otherwise say the evidence lives only in the container.

## A9. Hand-over

- The pushed branch, **not merged**.
- `CREATIVE-STUDIO.md` s.54 (baseline, system map, ledger with statuses, the defaults taken for D1-D7, what was not verified,
  the runs), a `CLAUDE.md` paragraph, `tests/README.md` lines, `TESTING.md`.
- The owner's release steps, in order: `tools/deploy-worker.sh --dry-run`, then deploy; check `/studio/status` answers the
  RC build and `/` the new deploy token; fast-forward merge the branch to `main`; check the page loads the new `?v=`;
  `python3 tools/studio-test-kit.py seed --apply`; make the testers' links (`tools/guest-link.py add <name> --days 14`,
  `--full` only for named testers); then the capped owner check
  `python3 tools/studio-smoke.py --key $AXIOM_KEY --cases synth --approve-calls 24 --approve-renders 0`.

## A10. Final report

1. Base and RC commits, build and page, the CI run for each, the pushed head.
2. A short architecture and user-flow summary (from the s.54 map).
3. The ledger: fixed (each with the test that failed before and passes now, and file references), not reproduced, decision
   needed, known limits.
4. Commands actually run with exact counts before and after (pass / fail / skip, skips named), the sweep summary, flake
   re-runs, and environment limits kept apart from code failures.
5. Performance before and after against A6.
6. What was proven only with mocks, and what needs the owner, Cloudflare or a live provider to prove.
7. Readiness, criterion by criterion, with evidence for each:
   - **Ready for internal testing:** `test:release` green with skips named; CI green in three engines on the RC; the
     enforcing sweep clean (dark and light); no blocker or high open; the owner has deployed the RC worker with the page and
     `/studio/status` answers its build; `AXIOM_PUBLIC` off (or `read` with an end date); the guard flags unset; the seed
     verified; a link per tester, read-only by default; the owner's capped smoke run read; Part B cases pass by hand.
   - **Ready for client testing:** all of that, plus one clean internal round with every re-test closed; D2 built and proven
     on every route, or clients limited to review links; D3 accepted in writing or built; K4 and S4 fixed; an owner-run live
     evaluation of campaign inference and directions read; one real render validated and reviewed composed; the review link
     passing on a phone in WebKit; `/studio/identity` clean for MCA and HOOF.
   - **Not ready**, with reasons, otherwise.

The run is done when the baseline came before any edit, every ledger row has a status and evidence, each fix shares a commit
with its fail-then-pass test, the gate and the sweep are green or each failure is named as environmental, the docs are
updated, the branch is pushed and not merged, and nothing was deployed or spent.

---

# Part B - the team's test round (for people)

Starts after the owner has reviewed the run's branch and done A9's release steps. Everyone tests on the live page with the
synthetic client "Harbourline Ferries"; nothing here touches a real client unless a case says so.

## B1. Roles

| Role | Who | Does |
|---|---|---|
| Lead | an agency engineer | the gate, the seed, links, daily triage |
| Testers (3-5) | account managers, copywriters, designers, strategists | the journeys for their role; each has their own full link |
| Reviewers | anyone | read-only links; look and report |
| Owner | Heshan | deploy, merge, sign-off |

## B2. Before the round (lead, about 1 hour)

1. Confirm the worker answers the RC build (Help shows it) and the page loads the RC's `?v=`.
2. Seed the synthetic client; open one parked project per stage.
3. Make one link per person (14 days; read-only unless they are a named tester).
4. A 15-minute kickoff: the seven stages, what costs money (every paid action asks first; Cancel spends nothing), and Report a
   problem.

## B3. Schedule

- **Day 0:** the release steps, the seed, the lead runs the cases once.
- **Days 1-3, round 1:** each tester runs the cases for their role (60-90 minutes) plus 30 minutes on one focus area.
- **Day 4:** fixes and a new RC.
- **Day 5, round 2:** two testers per case on the new RC; sign-off.
- **Close:** `tools/studio-test-kit.py reset --apply`, then remove the links.

## B4. Cases (free unless marked)

Screenshots: `T<n>-<width>x<height>-<state>.png`.

| # | Role | Steps | Expected |
|---|---|---|---|
| 1 | Everyone | Help, Report a problem, Copy | The RC's page release and worker build, and "N left today" for you |
| 2 | Account manager | Wizard, Response creative, Harbourline, let Axiom detect the campaign; paste the ambiguous brief | Two campaigns offered with their evidence and one question; nothing applied until you choose; the campaign with more material is not picked for that reason |
| 3 | Strategist | Same client, choose Standalone, through Message to Copy | Copy is written with no dead end; no campaign fact, URL or wordmark appears; the checks agree on recheck |
| 4 | Strategist | Material: "A columnist mocked the ferry livery" | "Monitor" or "no response" offered; recording it needs a reason; no directions generated |
| 5 | Copywriter | Night boat, Copy; ask for "cheap" and "99 crossings" | "cheap" flagged (unless negated); 99 flagged as unsupported; the harbour URL flagged as the wrong campaign's; "ready for design" files nothing |
| 6 | Designer | Night boat, Design, Editable, no imagery; select the headline; Spacing +20 px, a saved colour; Undo and Redo; Save; reload | Wordmark only, held in place; the move and colour persist; contrast grade shown; one undo step per change |
| 7 | Designer | Open each Design panel at 1920, 1440, 1280 and 1024 wide; press Escape | The tool bar stays one row; the panel's title and close are visible; Escape closes it |
| 8 | Designer | On the blocked tile: Fix layout, Undo fix, Layout variations, Use this layout | An outcome with counts, "no render", and your allowance unchanged |
| 9 | Creative lead | Creative Director: Review this version (1 model call); edit the headline; come back | Each score has a reason or "not scored"; the review says "outdated: judged vN"; nothing reads as approved |
| 10 | Everyone | Generate imagery, then Cancel on the cost question | The worst case is named; nothing is created; your allowance is unchanged |
| 11 | Account manager | Review: Measure them here; approve copy and design with a reason; share a review link; comment and approve in a private window; then edit the piece | "Name as given, not verified"; the link expires in 30 days or less; the edit drops the approval |
| 12 | Account manager | Deliver: prepare and download | Only approved, measured pieces; each PNG at its format's size and the same as Review measured; the manifest names its hash |
| 13 | Everyone | Every stage at 834 and 390 wide; then switch to Light | No sideways scroll or overprinting; the chosen appearance is visibly selected |
| 14 | Guest boundary (lead) | With a full guest link, open an MCA project; try Teach this brand on MCA | "Read-only for a guest link"; the brand change is refused and nothing changes. Note which other clients you can see (a known limit until per-client scope is built) |
| 15 | [Agency key, MCA, no paid call] | Brand workspace for MCA; `/studio/identity?ns=mca` | HOOF lists its wordmark only, MCA national the logo; facts scoped by campaign; a missing mark shows as missing |
| 16 | [Paid, about 15 calls, no images, lead only] | The wizard with the off-topic brief | The off-topic paragraph set aside; 99 flagged; the job cards show what was sent and the estimate while it runs |

## B5. Reporting and triage

Report only through Help, Report a problem, naming the case number and step. The lead triages daily (15 minutes).

- **Blocker:** data lost, another client's or live material touched, money spent without asking, an unapproved or unmeasured
  piece delivered, the wrong mark, or a case that cannot be finished. Pause that case; fix within a day.
- **High:** a wrong progress, approval or validation state with a workaround, or a serious accessibility problem. Fix before
  round 2.
- **Medium:** confusing, or slower than the targets. Schedule it.
- **Low:** wording. Record it.

A report closes only when its step passes on the fixed release. The lead signs off the internal round; the owner signs off
client testing.

## B6. Known limits (say so; do not report them as new)

- A guest link can read every client's projects, briefs and knowledge until per-client scope is built: internal testers only.
- The technical pass trusts some figures the browser measures (contrast, ink); stated in the readiness panel.
- Everything was proven with mocked providers; real image and model behaviour is proven only by the owner's capped run.
- Firefox and WebKit are covered by CI, not by hand, unless a tester uses them.
