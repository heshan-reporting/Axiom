# Testing the Creative Studio

This page is for the people running a test round of the AXIOM Creative Studio, and for the testers themselves. It says who can
do what, where to test, what to try, what costs money, what is known not to work yet, and how to report a problem. Build
`2026-11-05.studio-p43`, page release `?v=r26` (S28; `CREATIVE-STUDIO.md` s.51 holds the findings behind it).

## Before a round: the gate

A round starts only when all of these hold:

1. `npm run test:release` passes on the branch being tested: the static checks, every backend harness and every browser harness,
   with providers mocked. CI runs the same on every push, in Chromium, Firefox and WebKit (`studio-xbrowser-browser`,
   `studio-s26-xbrowser-browser`).
2. No serious or critical accessibility finding: `node --experimental-sqlite tests/studio-s27-sweep.mjs after` writes
   `tests/shots/s27/after-sweep.json`; every row's `axe` list is empty.
3. Every scripted journey below passes once by hand on the deployed page with the synthetic client.
4. No finding in the ledger (`CREATIVE-STUDIO.md` s.51) is open at "blocker".
5. The worker and the page are deployed together: `/studio/status` answers the build above, and the page loads `?v=r26`.

## Roles

| Who | Key | Can | Cannot |
|---|---|---|---|
| Reviewer | guest link, read-only (the default) | open every step, read projects, run Measure and Check, copy a problem report | create, change, approve or spend |
| Tester | guest link with `--full` | create test projects, write, generate within their daily allowance, approve inside test projects, send a problem report | change a live client's brand kit, taught rules or standing corrections; make a project count as live work |
| Agency | roster key | everything | - |

Make the links on the Mac: `python3 tools/guest-link.py add "Name" --days 14` (read-only) or `... --full` (tester). Each person gets their
own link: drafts, the daily allowance and every approval belong to the person (a hash of their key), never to a shared name.
Open access (`AXIOM_PUBLIC`) is read-only in the Studio; testers need their own link.

## Where to test

Use the synthetic client **Harbourline Ferries - SYNTHETIC DEMO CLIENT** (namespace `synthdemo`). Seed it once:

```
python3 tools/studio-test-kit.py seed --key $AXIOM_KEY            # shows what it would write
python3 tools/studio-test-kit.py seed --key $AXIOM_KEY --apply    # kit, marks, two test projects; no model call
```

Everything made in `synthdemo`, and every project a guest link makes in any client, is a **test project**: it carries a "test"
badge, nothing it decides is filed in a client's memory (no WIN or LOSS exemplars, no intelligence log, no brand proposals, no
lasting rules), and it is left out of the outcome metrics. Clear a round away afterwards:

```
python3 tools/studio-test-kit.py reset --key $AXIOM_KEY --apply   # archives the test projects (never deletes), each named
```

or in the library: the "Live and test" filter, then "Archive all test projects".

## Scripted journeys

Each is short; note the time it takes and anything that surprised you.

1. **Guided project to delivery.** New project, Response creative, Harbourline, the Harbour crossings campaign, paste the brief
   from the first sample project. Create and analyse. Confirm the understanding, the objective and message, the strategy. Choose a
   direction in Explore. Write the copy; tick "Mark this copy ready for design" on each piece. In Design choose Editable creative and
   **Cancel** the generate question (no imagery is needed). Try Layout variations and Fix layout. In Review & Deliver press
   **Measure them here**, approve the design of one piece with a reason, open Delivery, prepare and download the package.
   Check: the package holds only the approved piece; its PNG is the one Review measured.
2. **Classic project.** From the library, a project without the wizard; propose directions; choose one; write copy; then choose a
   different direction. Check: the Studio asks what to do with the pieces written from the first one.
3. **Finished creative.** In Design choose Full AI creative on the copy-only sample. Check the cost question names the worst case
   and that Cancel spends nothing.
4. **Client review link.** In Review, share one approved piece (the expiry list stops at 30 days). Open the link in a private
   window, comment with a pin, approve with a name. Check: the agency's thread says "through the review link ... name as given, not
   verified", and the Delivery manifest says the same.
5. **Teach this brand (synthetic client only).** Brand workspace, Teach this brand, preview and confirm a banned term with a reason.
   Then restore the kit from its history (`POST /brand/kit/restore` or ask the agency). A guest link is refused on a live client.
6. **Explore and refine.** In Design, Creative Director: Review this version, then Suggest; apply one suggestion; Undo.

## What costs money

Every paid action states its cost and its worst case before it runs, and asks. One "model call" is one request meant; a
request that fails is retried (at most 3 times), and a stage that must re-plan look-alike work asks twice, so:

| Action | Worst case |
|---|---|
| Analyse the brief | 3 requests, plus 3 for each uploaded file it must read first |
| Propose, refine, merge or explore directions | 6 requests |
| Write the copy | 6 requests |
| Generate imagery (one render job) | 4 image requests, plus a review of up to 3 requests |
| Creative Director review, suggestion, revise | 3 requests |

Your allowance today and the agency's are in the header chip ("N left today"; hover for the detail). Defaults: 120 model calls and
40 image requests a person a day, 40 and 12 for a guest link (`STUDIO_PERSON_DAILY_*`, `STUDIO_GUEST_DAILY_*`). The job card
says what each job actually sent.

## Known limits (say so, do not report them as new)

- The technical measurement is made in the tester's browser; the worker re-judges its geometry, words and fonts and checks the PNG's
  type and size, but takes the pixel figures (contrast, ink readability) as reported. The validated PNG is stored under its own hash
  and is what the client sees and what is delivered.
- A client's approval through a review link is whoever holds the link, under the name they type. Treat it as a link approval.
- Keys are agency-wide by client: a guest link can open every client's projects to read. Per-key client scope is proposed, not built
  (`CREATIVE-STUDIO.md` s.51, decision D1).
- Imagery needs `GEMINI_KEY` and real renders; the scripted journeys do not need imagery.
- Drafts made before S28 were kept under display names and are not shown to anyone now; the browser's own working copy still holds
  an unsaved edit.

## Reporting a problem

In the Studio: the **?** button (How the Studio works), then **Report a problem**. Write what you did, what you expected and what
happened. The report carries the page release, the open project, piece and view, the codes and request ids of the last problems
shown, your browser and window size; never your key, and no client text beyond what you write. A full key sends it to the team
(`GET /studio/feedback` lists them, and the project's thread shows it); a read-only link copies it for you to paste.

## After a round: the live check (agency only)

Paid, capped, run by the agency from a Mac, never by a tester or an assistant:

```
python3 tools/studio-smoke.py --key $AXIOM_KEY --cases synth --size 1K --approve-calls 24 --approve-renders 0
```

It prints the worst-case estimate first and runs nothing without `--approve-calls`; it works only in `synthdemo` (test projects),
never approves anything, and keeps its projects unless `--archive`. Read `smoke/index.html` afterwards: every step's state, the
requests sent against the allowance, and the export's included and left-out pieces.
