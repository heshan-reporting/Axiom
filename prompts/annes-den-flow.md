# Claude Code prompt: Anne's Den - a high-end interface built around the analyst's morning

Paste everything below the line into Claude Code, opened at the root of the `Axiom` repository.

---

You are working in the AXIOM repository. Read `CLAUDE.md` (the sections "The monitoring desk and Anne's Den" and "The
interface"), `DEN.md` s.6 and s.10, `docs/den.js`, `docs/den.css`, and the Den harnesses in `tests/` before you change a
line. `DEN.md` s.10 is what the last redesign built and what it decided against; start from there, not from scratch.

## The goal

The owner's words: "fully upgrade the current UI of Anne's Den to be upscaled and high end production grade UI with a
smooth user flow and UX." The last redesign made the page look like a product. This one makes it work like one: the
page should lead an analyst through her morning instead of handing her five tabs.

Her morning is four acts, always in this order: **check what was read** (a channel that delivered nothing is not a quiet
day), **triage the window's rows** (keep, set aside, open), **write the brief** from what she kept, **file it**. Design
the flow so the next act is always one obvious press away, nothing she has to remember lives in her head, and nothing
she typed can be lost.

## The direction (the owner chooses one before you build)

Three approaches were drawn on a design canvas; the owner will name one, or a mix:

- **A - Guided run.** A four-step rail (Check coverage, Triage, Write, File). Triage shows one row at a time with large
  Keep / Set aside / Open actions and a queue beneath; a tray beside it fills section by section, with "Nothing
  critical missed" ticking off as rows are kept. Best for speed and for someone new to the desk.
- **B - Command desk.** Dark and dense: an icon rail, a command bar, a strip of figures, one sortable table of the whole
  window with a detail panel for the selected row, and a footer of keyboard hints. Best for a fast expert who lives on
  the keyboard and wants everything in view.
- **C - Briefing document.** The brief is the page: a section outline with states on the left, the document in the
  middle with numbered citation marks, and the evidence for the section in view on the right, where kept rows not yet
  cited wait with a "Cite here" action. Best for the quality of the written report.

If the owner has not chosen, ask once, showing the canvas. Do not build all three.

## What must not change

Every behaviour in `DEN.md` s.6 and every rule listed under "What still holds" in s.10: the computed strip with
collection gaps first, the stated cost before any model call, the draft's checks, save on leaving a field, Keep mine /
Take theirs, restore after a reload, file and reopen, the exports, read-only keys, every keyboard shortcut. No new model
call. The worker contract changes only by adding. No build step, no CDN, no charting library; colours and corners are
tokens (`tests/studio-tokens-test.mjs`). Commenters and unregistered accounts are never named. Light and dark both
work.

## How to run it

1. Write the flow down first, in `DEN.md`: each act, what the page shows, the one primary action, what happens on every
   failure. Get the owner's yes on that page before any code.
2. Build one act at a time behind the existing areas, so the page works at every commit. After each, run
   `tests/den-worker.mjs`, `tests/den-browser.mjs`, `tests/den-inject-browser.mjs` and `tests/studio-tokens-test.mjs`.
   A test changes only because the control it finds changed, and each such change is listed in your report.
3. Add browser cases for the flow itself: the whole morning from an unread window to a filed brief by keyboard alone;
   leaving and returning mid-triage and mid-sentence loses nothing; every read failing still says what failed and
   offers one press to try again; axe passes in both themes at 1366, 1440 and 1920; no sideways scroll at 1024.
4. Bump the `?v=` of every changed script and stylesheet in `docs/index.html`, run
   `node tests/asset-versions.mjs --write`, and retake `tests/den-shots.mjs`. Look at every screenshot yourself.

## What to hand back

Before and after screenshots of each act; the flow as written and as built; every test changed and why; what could not
be checked in the sandbox (a real draft, live data, a paste into a real Google Doc) and what checks each; and anything
asked for here that you did not build, with the reason.
