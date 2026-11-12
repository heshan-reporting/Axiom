# Testing the Creative Studio

This page is for the people running the team's test round of the AXIOM Creative Studio, and for the testers themselves. It
says how the release goes live, who can do what, where to test, what to try, what costs money, what is known not to work yet,
and how to report a problem. Release candidate: worker build `2026-11-12.studio-p65`, page release `?v=r45` (`den.js?v=r48`). The findings and
the evidence behind it are in `CREATIVE-STUDIO.md` s.54 to s.58 (s.56 the p46 audit fixed, s.57 the p47 audit fixed, s.58 the UI
debt closed); the round's
cases for people are Part B of `prompts/studio-rc-team-test.md`. Build ids carry the date the build was made; p46 and p47 were
stamped with dates ahead of their commits, so from p48 on the date is the commit's and only the `pNN` number orders builds.

## The owner's release steps (in this order, from the Mac)

1. `tools/deploy-worker.sh --dry-run`, then `tools/deploy-worker.sh`. It refuses a worker with no access key and fails unless the
   live worker answers the new deploy token.
2. With `AXIOM_KEY` exported: `/studio/status` answers build `2026-11-04.studio-p48`, `testNs` names `synthdemo`, and `posture`
   shows how the worker is opened (public mode, guard flags, roster and guest counts; never a key). The guard flags
   (`STUDIO_PUBLIC_WRITE`, `STUDIO_GUEST_BRAND`, `STUDIO_GUEST_LIVE`, `AXIOM_GUEST_WRITE`, `AXIOM_DEV_OPEN`) should all read false.
3. Fast-forward merge the branch to `main`; check the page loads `?v=r39`. A page newer than its worker says so in a banner
   ("The worker is older than this page") - if a tester sees it, the worker was not deployed.
4. Public mode, if kept for the round (decisions D4 and D7): `AXIOM_PUBLIC=read` and `AXIOM_PUBLIC_UNTIL` set to the deploy date
   plus 14 days. Open access never writes anything (every anonymous write and acting request answers `public_write_refused`),
   and it does not show client work: the Studio, brand kits, the Mind, the Engine, the Content and Release desks and campaign
   performance need a link (`401 sign_in_required`; `STUDIO_PUBLIC_READ=1` reopens them, which publishes client material).
5. Seed the synthetic client: `python3 tools/studio-test-kit.py seed --key $AXIOM_KEY` (a dry run listing what it would write),
   then the same with `--apply`. Optionally one set per tester: `--tester "Name"`.
6. Make each tester's link: `python3 tools/guest-link.py add "Name" --days 14` (read-only), `--full` only for named testers.
   Add `--ns synthdemo` to keep a tester to the synthetic client (or `--ns mca` for someone who should see MCA only): a scoped
   link lists only those clients and is refused every other client's projects, files, kit, artwork and Mind, and the rest of
   AXIOM (`403 guest_client_scope`). `renew "Name" --ns ...` changes it; `--ns all` removes the limit.
7. The capped owner check, after the seed (it keeps the seeded kit and adds its own campaign to it): `python3 tools/studio-smoke.py --key $AXIOM_KEY --cases synth --approve-calls 24
   --approve-renders 0`. Read `smoke/index.html`.
8. On the deployed page with a full key: open "TEST - parked at Review" and press Measure them here once. The worker now reads
   each measured PNG itself (about 0.1-0.2 s of CPU a tile); measurements that file are the live proof that the account's CPU
   limit allows it (`CREATIVE-STUDIO.md` s.54.5).

## The gate before a round

1. `npm run test:release` passes on the commit being tested (checks, every backend harness, every browser harness, the
   accessibility gate `studio-a11y-browser`), with providers mocked; a harness that skipped part of its work (an engine not
   installed) is listed as skipped, never passed. CI runs the same on every push in Chromium, Firefox and WebKit.
2. No blocker or high finding open in `CREATIVE-STUDIO.md` s.54 to s.58.
3. The release steps above are done; the scripted journeys below pass once by hand on the deployed page.

## Roles

| Who | Key | Can | Cannot |
|---|---|---|---|
| Reviewer | guest link, read-only (the default) | open every stage, read projects and the measurements a full key filed, copy a problem report | create, change, measure, approve or spend |
| Tester | guest link with `--full` | create test projects, write, generate within their daily allowance, approve inside test projects, change the synthetic client's kit, send a problem report | change a live client's projects or memory by any route |
| Agency | roster key | everything | - |

Each person gets their own link: drafts, the daily allowance and every approval belong to the person (a hash of their key).
A guest key without `--ns` can read every client's projects, briefs and Mind documents (decision D2: internal testers only;
clients see work only through review links). A key made with `--ns` reads and works only in the clients it names (S31).

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
4. **Guided project end to end** (paid, about 15 model requests - a retried request counts again - no images): New project, Response creative, Harbourline, paste the
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

- The measurement is made in the browser. The worker re-judges geometry, words, type size and lines, and reads the filed PNG
  itself for the contrast of the words and the readability of every mark drawn from a transparent PNG file - at any bit depth,
  interlaced or not, faded, turned or cropped (S31, `CREATIVE-STUDIO.md` s.57). A mark it still cannot read (an opaque file, a
  JPEG or WebP mark, a mark with an image effect) is shown in Checks and in the approval dialog as **checked in the browser
  only**, with the reason, and the approval records it; it can still be approved after a person has looked. Occlusion, the
  photograph's subjects and the fonts that drew are still the browser's figures.
- A client's approval through a review link is whoever holds the link, under the name they type.
- A guest link made without `--ns` can read every client's work (decision D2).
- The daily brief (all clients) is part of the shared `cmm` memory every client's analysis may read (decision D5); the
  Content Desk saves standing preferences automatically (decision D6).
- Imagery needs `GEMINI_KEY` and real renders; the journeys above need none except where marked.
- Firefox and WebKit are proven in CI; a tester's Safari is the first live check of the review page on a phone.
- A brand mark, logo or artwork upload must be a whole image: a PNG is decoded end to end, a JPEG must hold a frame and its
  scan data, a WebP a real VP8 / VP8L / animation chunk. A file that is only a header is refused (`bad_image`).
- A guest link scoped with `--ns` sees only the Studio of its clients; the rest of AXIOM (newsroom, narratives, the daily brief)
  is refused to it, by design.
- A scoped link cannot open the shared `cmm` memory itself, but an analysis it runs still draws on `cmm` passages (the daily
  brief covers every client, decision D5), so a scoped link is still for people inside the agency.
- Opening a project costs about ten database reads per asset, one after another, so a project of twenty or more assets may take
  a moment to open (`CREATIVE-STUDIO.md` s.54.5, P1). The seeded projects are small.

## Reporting a problem

In the Studio: the **?** button, then **Report a problem**. Say the journey and the step, what you expected and what happened,
how often it happens, and how serious it is (blocks the round / wrong result / awkward / cosmetic). The report carries the page
release and the worker build, the open project, piece and version, the codes and request ids of the last problems shown, your
browser and window size and the Sydney time; never your key. Add a screenshot when you can. A full key sends it to the team
(`GET /studio/feedback`); a read-only link copies it for you to paste.
