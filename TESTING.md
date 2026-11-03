# Testing the Creative Studio

This page is for the people running the team's test round of the AXIOM Creative Studio, and for the testers themselves. It
says how the release goes live, who can do what, where to test, what to try, what costs money, what is known not to work yet,
and how to report a problem. Release candidate: worker build `2026-11-07.studio-p45`, page release `?v=r29`. The findings and
the evidence behind it are in `CREATIVE-STUDIO.md` s.54; the round's cases for people are Part B of
`prompts/studio-rc-team-test.md`.

## The owner's release steps (in this order, from the Mac)

1. `tools/deploy-worker.sh --dry-run`, then `tools/deploy-worker.sh`. It refuses a worker with no access key and fails unless the
   live worker answers the new deploy token.
2. With `AXIOM_KEY` exported: `/studio/status` answers build `2026-11-07.studio-p45`, `testNs` names `synthdemo`, and `posture`
   shows how the worker is opened (public mode, guard flags, roster and guest counts; never a key). The guard flags
   (`STUDIO_PUBLIC_WRITE`, `STUDIO_GUEST_BRAND`, `STUDIO_GUEST_LIVE`, `AXIOM_GUEST_WRITE`, `AXIOM_DEV_OPEN`) should all read false.
3. Fast-forward merge the branch to `main`; check the page loads `?v=r29`. A page newer than its worker says so in a banner
   ("The worker is older than this page") - if a tester sees it, the worker was not deployed.
4. Public mode, if kept for the round (decisions D4 and D7): `AXIOM_PUBLIC=read` and `AXIOM_PUBLIC_UNTIL` set to the deploy date
   plus 14 days. Open access never writes anything (every anonymous write and acting request answers `public_write_refused`).
5. Seed the synthetic client: `python3 tools/studio-test-kit.py seed --key $AXIOM_KEY` (a dry run listing what it would write),
   then the same with `--apply`. Optionally one set per tester: `--tester "Name"`.
6. Make each tester's link: `python3 tools/guest-link.py add "Name" --days 14` (read-only), `--full` only for named testers.
7. The capped owner check, after the seed: `python3 tools/studio-smoke.py --key $AXIOM_KEY --cases synth --approve-calls 24
   --approve-renders 0`. Read `smoke/index.html`.
8. On the deployed page with a full key: open "TEST - parked at Review" and press Measure them here once. The worker now reads
   each measured PNG itself (about 0.1-0.2 s of CPU a tile); measurements that file are the live proof that the account's CPU
   limit allows it (`CREATIVE-STUDIO.md` s.54.5).

## The gate before a round

1. `npm run test:release` passes on the commit being tested (checks, every backend harness, every browser harness, the
   accessibility gate `studio-a11y-browser`), with providers mocked; a harness that skipped part of its work (an engine not
   installed) is listed as skipped, never passed. CI runs the same on every push in Chromium, Firefox and WebKit.
2. No blocker or high finding open in `CREATIVE-STUDIO.md` s.54.
3. The release steps above are done; the scripted journeys below pass once by hand on the deployed page.

## Roles

| Who | Key | Can | Cannot |
|---|---|---|---|
| Reviewer | guest link, read-only (the default) | open every stage, read projects, run Measure and Check, copy a problem report | create, change, approve or spend |
| Tester | guest link with `--full` | create test projects, write, generate within their daily allowance, approve inside test projects, change the synthetic client's kit, send a problem report | change a live client's projects or memory by any route |
| Agency | roster key | everything | - |

Each person gets their own link: drafts, the daily allowance and every approval belong to the person (a hash of their key).
A guest key can read every client's projects, briefs and Mind documents (decision D2: internal testers only; clients see work
only through review links).

## Where to test

Choose **Harbourline Ferries - SYNTHETIC DEMO CLIENT** in the Studio's client list, under "Synthetic test clients". The seed
parks a project where each journey starts, so nothing costs a model call before you reach the part you are testing:

| Project | Starts at | For |
|---|---|---|
| TEST - harbour crossings tile | Brief, with a client note to analyse (one off-topic paragraph, the unapproved "99 crossings" figure) | reading a brief; paragraphs set aside; unapproved figures flagged |
| TEST - no campaign chosen yet | Brief, no campaign, two in the kit | the Studio asks for the campaign (it never picks the one with more material) |
| TEST - parked at Direction | three directions in three media | choosing, refining, merging directions |
| TEST - parked at Copy | copy written from a chosen direction | editing words, marking copy ready |
| TEST - parked at Design (one passes, one blocks) | two tiles on a solid ground | measuring, Fix layout, variations, the canvas |
| TEST - parked at Review (nothing approved) | night boat tiles laid out to pass | Measure them here, approving, Deliver |
| TEST - night boat copy only | Brief | copy-only work |

The night boat campaign carries its own wordmark, held bottom right by a mandatory rule, never the Harbourline logo; harbour
holds four approved facts and night boat one, on purpose. Everything in `synthdemo` is a test project: nothing it decides is
filed in a client's memory and it is left out of the outcome metrics. Clear a round away with `python3
tools/studio-test-kit.py reset --key $AXIOM_KEY --apply` (archives, never deletes) or "Archive all test projects" in the library.

Two briefs to paste (synthetic):

- *Ambiguous between the campaigns:* "Harbourline will run a late ferry on Friday nights from Pier 3, and two more morning
  crossings from Circular Wharf from Monday. Please let riders know this week."
- *With an off-topic paragraph and an unapproved figure:* the client note in "TEST - harbour crossings tile".

## Scripted journeys

1. **Design without spending.** "parked at Design": open the blocked tile, press Fix layout, then Undo fix; try Layout
   variations and Use this layout; select the headline and use the Style panel (Spacing, Size, the colour picker and its
   contrast). Check: no model call, the allowance unchanged, each change a new version "(no render)".
2. **Review and Deliver.** "parked at Review": press Measure them here; approve copy and design of one tile with a reason; in
   Deliver prepare and download. Check: the package holds only the approved tile; its PNG is the one measured; the wordmark is
   the night boat's, bottom right.
3. **The campaign question.** "no campaign chosen yet": analyse the note (paid, about 3 calls), compare two narratives and
   press Produce 2 as variants. Check: the Studio asks for the campaign and produces nothing; choose the campaign in the brief, then produce.
4. **Guided project end to end** (paid, about 15 calls, no images): New project, Response creative, Harbourline, paste the
   ambiguous brief. Check: the reading proposes campaign candidates, does not decide; the objective, message, strategy and a
   direction lead to copy.
5. **Client review link.** In Review, share one approved tile (14 days by default, at most 30). Open the link on a phone, comment
   with a pin, approve with a name. Check: the agency's thread says "through the review link ... name as given, not verified".
6. **A guest link on a live client.** With a tester link, open an MCA project. Check: "read-only for a guest link"; nothing
   can be written there.

## What costs money

Every paid action states its cost and its worst case before it runs, and asks:

| Action | Worst case |
|---|---|
| Analyse the brief | 3 requests, plus 3 for each uploaded file it must read first |
| Propose, refine, merge or explore directions | 6 requests |
| Write the copy | 6 requests |
| Generate imagery (one render job) | 4 image requests, plus a review of up to 3 requests |
| Creative Director review, suggestion, revise | 3 requests |

Your allowance today is in the header chip. Defaults: 120 model calls and 40 image requests a person a day; 40 and 12 for a
guest link (`STUDIO_PERSON_DAILY_*`, `STUDIO_GUEST_DAILY_*`).

## Known limits (say so; do not report them as new)

- The measurement is made in the browser. The worker re-judges geometry, words, type size and lines, and since this release
  reads the filed PNG itself for the contrast of the words and the readability of a mark drawn from a transparent file
  (`CREATIVE-STUDIO.md` s.54.4). Occlusion, the photograph's subjects, the fonts that drew and the readability of an opaque,
  rotated, faded or cropped mark are still the browser's figures.
- A client's approval through a review link is whoever holds the link, under the name they type.
- A guest link can read every client's work (decision D2).
- The daily brief (all clients) is part of the shared `cmm` memory every client's analysis may read (decision D5); the
  Content Desk saves standing preferences automatically (decision D6).
- Imagery needs `GEMINI_KEY` and real renders; the journeys above need none except where marked.
- Firefox and WebKit are proven in CI; a tester's Safari is the first live check of the review page on a phone.
- Opening a project costs about ten database reads per asset, one after another, so a project of twenty or more assets may take
  a moment to open (`CREATIVE-STUDIO.md` s.54.5, P1). The seeded projects are small.

## Reporting a problem

In the Studio: the **?** button, then **Report a problem**. Say the journey and the step, what you expected and what happened,
how often it happens, and how serious it is (blocks the round / wrong result / awkward / cosmetic). The report carries the page
release and the worker build, the open project, piece and version, the codes and request ids of the last problems shown, your
browser and window size and the Sydney time; never your key. Add a screenshot when you can. A full key sends it to the team
(`GET /studio/feedback`); a read-only link copies it for you to paste.
