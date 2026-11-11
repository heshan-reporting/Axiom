# Claude Code prompt: Anne's Den - a total interface upgrade (two passes built: page `?v=r46`; worker unchanged at `studio-p58`)

Paste everything below the line into Claude Code, opened at the root of the `Axiom` repository.

---

You are working in the AXIOM repository. Read `CLAUDE.md` first: it is the system map and its rules apply. For this work
read the sections "The monitoring desk and Anne's Den" and "The interface (Phase 5)", then `DEN.md` s.6 and s.7, then
`docs/den.js`, `docs/den.css`, `docs/axiom-ds.css`, `docs/ax-ui.js` and `docs/styleguide.html` whole. Read
`tests/den-fixture.mjs`, `tests/den-browser.mjs`, `tests/den-inject-browser.mjs`, `tests/den-shots.mjs` and
`tests/studio-tokens-test.mjs` before you change a line: they are the gate this work has to pass.

## The goal

The owner's words: "The current UI looks primitive and boring. Can we design a better UI like in
https://www.meltwater.com/en ... a total UI upgrade to look professional, production grade and reliable."

Read that as: Anne's Den should look and feel like a commercial media-intelligence product that an analyst is glad to
open every morning and that the agency can put in front of a client. Everything the page does today keeps working. This
is a redesign of the interface, not of the desk's rules.

## What is wrong today (seen, not assumed)

Run `node --experimental-sqlite tests/den-shots.mjs` and look at `tests/shots/den/*.png` before anything else. Keep a
copy of these as the "before" set. What they show at 1366 x 768:

1. **The page starts 250 px down.** Masthead, page title, two lines of text navigation and the scope bar sit above the
   desk. The scope bar does not drive the Den (a desk is the scope) and is shown anyway.
2. **The work is below the fold.** "Nothing critical missed" fills the rest of the first screen; the first row of Today
   begins at about 640 px. Brief, the thing she files, is two clicks and a scroll away.
3. **Nothing has weight.** Every block is the same hairline box with the same small uppercase mono label. There is no
   figure, no chart, no summary: the page never says how big or how unusual the day is.
4. **It reads as a database admin screen.** Native selects, underlined blue links as the only actions, outlined chips,
   tables for everything, a brief written in bare text boxes with citation ids in square brackets.
5. **No sense of source.** A masthead story, a Facebook post and a Senate committee notice look identical.
6. **Dark only**, although the report she writes ends up in a white document.

The first pass (below) answers 1, 3 and 6 and part of 2 and 4; 5 is still open.

## The reference (the owner chose it)

After the first version of this prompt the owner sent a reference image and said: "follow the following reference UI
style ... and proceed with the build". The reference is a light analytics dashboard (a generic "Visiora" concept shot,
not a product to copy). What it is made of, and what the Den takes from it:

- a soft grey ground with one large white workspace card, hairline borders, 10-14 px corners and a faint shadow;
- a left side menu: an account card on top, grouped menu items with small line icons, the current item a white raised
  pill, a card at the foot;
- a header line with the title and a one-line subtitle on the left and controls on the right;
- segmented controls (a grey track, the chosen item a white pill) and white buttons with a hairline; the one primary
  action is near-black;
- a row of joined figure tiles: a small coloured tick and a label, a large figure with its change in green or red, and
  a grey footer line of context;
- a stacked bar chart with dashed gridlines, pale bars, and the hovered bar striped with a dark tooltip listing each
  series;
- lower cards in a grid: striped horizontal bars with the figure at the right, a segmented share bar with a legend of
  figures, small charts;
- one geometric sans throughout, sentence case, no uppercase mono labels.

Take the layout, density, surfaces and controls. Do not take its name, logo, sample data or emoji. An earlier request
named meltwater.com as inspiration; that site could not be reached from the sandbox and nothing here is taken from it.

## A decision this overturns (record it)

`CLAUDE.md` "The interface (Phase 5)" and the header comment of `docs/den.css` say: flat 8 px panels, tables not cards,
one hairline strip of figures, no elevation, no entrance animation. **For Anne's Den only, the owner has overturned
that.** Write the decision into `DEN.md` (a new s.8) and `CLAUDE.md` with the date and the owner's words, and state
what still holds: semantic colour carries meaning only, numbers are tabular, every figure opens the rows behind it,
and an empty table is never read as a quiet day. Do not restyle any other view in this work.

## What must not change

- **Behaviour.** Every feature in `DEN.md` s.6 stays: desks, the five areas (Today, Brief, Watch, Collection,
  Options), pin / set aside with a reason / mute offer, the computed strip with collection gaps first, the stated cost
  before a model call, the checks on a draft (uncited, unverified, thirty-word cut, blank rating), save on blur and
  Ctrl/Cmd+S, Keep mine / Take theirs, restore after reload, file and reopen, History and Compare, the four exports,
  Preview / Approve / Dismiss with a reason, Collect now with its console, the kill switches, read-only keys, every
  keyboard shortcut, `AXUI.goto('den', {desk, tab})`.
- **Honesty of states.** Every panel keeps loading, empty-with-why, error-with-retry and read-only states and its error
  boundary. A read that answers with the wrong shape is still an error in words. A redesign that turns a failure into a
  pretty blank is a regression.
- **The worker contract.** No route changes its shape. If a chart needs a series the page cannot derive from what
  `/den/board`, `/den/missed` and `/den/collection` already return, add fields or one read-role route, additively, with
  a case in `tests/den-worker.mjs`. No new model call anywhere. The worker stays pure ASCII.
- **The platform.** No build step, no bundler, no CDN: React UMD and `htm` from `docs/vendor/`, fonts from
  `docs/vendor/fonts/`. Charts are inline SVG written here, not a charting library. Anything new that is vendored needs
  its licence beside it. Nothing non-public moves into `docs/`.
- **Tokens.** `tests/studio-tokens-test.mjs` holds `den.css` to tokens: no hex outside the token files. New colours,
  radii, shadows, spacing and motion values are new tokens, documented in `docs/styleguide.html`.
- **Privacy rules in the data.** Commenters and unregistered accounts are never named; subscriber text shows thirty
  words. A card layout must not surface a field a table row did not.

## Built in the first pass (page `?v=r45`; `DEN.md` s.8)

- **Light theme while the Den is open.** `docs/den.css` re-declares the app's tokens on `body:has(#v-den.on)`, so the
  masthead and navigation turn light with the Den and return to dark on leaving it. The Den's own tokens (`--den-*`:
  surfaces, inks, status tints, chart series, radii, shadows) are declared on `#den-root`.
- **The frame.** A side menu (desk card, Today / Brief / Watch / Collection / Options as a vertical tablist with icons,
  the model-call meter) and one white workspace card. The scope bar is hidden in the Den. Below 1100 px the menu
  becomes a row.
- **The day in figures** (`Overview` in `docs/den.js`, on Today): five joined tiles (stories, social posts,
  interactions with the change since yesterday's read, narratives moving, rows in the report), each a button that
  jumps to its table; a stacked bar chart of the window by channel in twelve steps with a legend, a striped hover state
  and a tooltip; and three cards: by channel, most carried stories, tone under the posts. Everything is counted in
  the browser from `/den/board`: no route, no model call, and no figure the tables do not hold. A missing count says
  why and is never drawn as zero.
- **Chart colours** are a fixed order, one hue a channel, checked for colour-vision separation; three of them are under
  3:1 on white, so the legend, the tooltip and the tables carry the same facts in words.
- **Restyled, same markup:** the strip (two columns of cards), tables (a grey header band, sentence-case headings),
  tinted status chips, white and near-black buttons, segmented tabs in Watch, the brief's sections and editors,
  notices, dialogs.
- Every selector, role, label and shortcut the harnesses use is unchanged. `tests/den-browser.mjs` 24,
  `tests/den-inject-browser.mjs` 60, `tests/den-worker.mjs` 17, `tests/studio-tokens-test.mjs` 4, `node tests/run.mjs
  check` 26: all pass. One contrast failure (a green chip at 4.48:1) was found by axe and fixed.

## Built in the second pass (page `?v=r46`)

A dark theme by choice; a Cards / Table switch on Today; channel tiles above Collection's table; skeletons; citation
tips in the brief; a score meter in Watch; five new browser cases (`tests/den-browser.mjs` is 29). `DEN.md` s.8 has
the detail.

## What is left to build, in this order

Work to 1366 x 768 first, then 1440, 1920 and a usable 1024. Keep every rule under "What must not change".

1. **Brief as a document.** Ratings as segmented controls, citation ids as numbered chips inside the text that open
   the cited row in a panel beside the page, the two checks as inline marks with the reason in the margin, History and
   Compare in a side sheet, one "Get it out" menu. If the editors move off plain textareas, the working copy, save on
   blur, the conflict flow and every existing case still hold; if that cannot be guaranteed, keep textareas.
2. **Watch.** Proposals as review cards with their evidence; Preview in a side sheet with counts by channel.
3. **Options.** A settings page with a section index, switches, a keyboard-operable order for the report's sections
   and a Save bar that appears only when something changed.
4. **Collection.** A seven-day sparkline a channel (needs a daily series from the worker: add it to
   `/den/collection`, additively, with a worker case); the job console as a docked drawer.
5. **Controls.** A desk menu in place of the native select (keep a labelled select for the harness, or change the
   harness and say so) and a tooltip component.
6. **The styleguide.** A Den section in `docs/styleguide.html` showing every component in both themes.

After each item run the Den harnesses and retake that area with `node --experimental-sqlite tests/den-shots.mjs`.
Bump the `?v=` of `den.js` and `den.css` in `docs/index.html` on every page release and run
`node tests/asset-versions.mjs --write`.

## Proving it

- `node tests/run.mjs all` passes. The Den harnesses keep at least their present counts: `tests/den-worker.mjs` (17),
  `tests/den-browser.mjs` (24), `tests/den-inject-browser.mjs` (60), `tests/den-tools-test.py` (54). A test is changed
  only because the markup it reads changed, never to make a failure go away, and each such change is listed in your
  report. Prefer keeping the roles, labels and ids the harnesses select on.
- New browser cases as each item lands: Cards and Table give the same rows in the same order; every tile opens its
  rows; the section order can be changed by keyboard; both themes once the dark one exists; no horizontal scroll at 1024.
- Accessibility: axe clean at 1366, 1440 and 1920 for a full and a read-only key in both themes; text contrast 4.5:1
  and interface contrast 3:1; every action reachable and operable by keyboard with a visible focus ring; focus is
  trapped in and returned from sheets and dialogs; reduced motion honoured.
- Speed: the Den's first paint of the header and skeletons does not wait on any read; no layout shift when data lands;
  a board of 500 rows scrolls without dropped frames (window the feed if it does not).
- Look at every screenshot yourself, at every width, in both themes, with real-length text: long headlines, a desk with
  nothing collected, every read failing, a filed brief, a conflict.

## What to hand back

The before and after screenshots; the decision as recorded; the list of components; every test changed and why; what
was not verifiable in the sandbox (a real draft from a real model, a live archive, paste into a real Google Doc) and
what verifies each; and anything asked for here that you did not build, with the reason. Do not call it finished while
any harness is red or any state is undrawn.
