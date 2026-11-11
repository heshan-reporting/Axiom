# Claude Code prompt: Anne's Den - a total interface upgrade (after release 6: worker `studio-p58`, page `?v=r44`)

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

## The reference, and how to use it

Open https://www.meltwater.com/en and the product pages under it and study them yourself (the hero, the product
dashboard screenshots, the navigation, how figures and feeds are framed). **If your sandbox cannot reach the site, say
so and ask the owner for screenshots; do not describe it from memory as if you had looked.** The session that wrote this
prompt could not reach it, and could confirm only that the site was rebuilt in 2026 around plain pages that say what the
product does, with a new design system and an AI assistant ("Mira") given a visible place.

Take the qualities of that class of product, not its brand:

- a calm ground, generous spacing and one confident accent; hierarchy carried by size and space, not by borders;
- the day told in a handful of large figures with their change, and a chart beside them;
- a feed of readable mention cards (source mark, outlet, time, headline, excerpt, reach or interactions, tone) instead
  of a grid of cells, with a compact table still one switch away;
- one persistent, uncluttered navigation and a workspace that fills the screen;
- the assistant's work (here, the drafted brief) shown as a first-class panel with its evidence beside it;
- restrained motion, soft elevation, rounded corners, real empty and loading states.

Do not copy Meltwater's logo, name, colours, typeface, illustrations, copy or page layouts. AXIOM keeps its own
identity. The result must be recognisably AXIOM and must not be mistakable for their product.

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

## The design to build

Work to 1366 x 768 first (her screen), then 1440, 1920 and a usable 1024. Light and dark themes, both first-class,
scoped to the Den (`#den-root[data-theme]`), default following the system, switchable in Options and remembered per
person.

**1. The frame.** In the Den, the scope bar is hidden and the app's two-line navigation collapses to one compact line
(or a slim rail, your call after the prototypes), so the desk header sits within the first 110 px. A sticky desk header
carries: client and desk (a proper menu, not a native select), the reporting window in words, the brief's state
(not started / drafting / draft / edited / filed, with the time), the model-call allowance, Refresh, and one primary
action that changes with state (Draft the brief - 1 call, Continue the brief, Mark as filed, Reopen).

**2. The day in figures.** Under the header, four to six tiles, each a large tabular figure, a plain label, the change
against the desk's own baseline, and a sparkline where a series exists: items in the window, stories after folding,
social interactions, needs attention, channels delivering out of channels relied on, and tone where held. Each tile
opens the rows behind it. A tile with no data says why; it never shows a zero that means "not collected".

**3. Needs attention** (the "Nothing critical missed" strip, renamed only on screen if the owner agrees; the
`aria-label` and the logic stay). A compact band of severity-ordered cards with an icon, one sentence and one action.
Collection gaps lead and are visually distinct from signals: a gap is about the desk's eyesight, a spike is about the
world. Collapsed, it is one line with counts by kind; it must never push Today below the fold again.

**4. Today.** Two columns at 1366 and up: the feed, and a rail. The feed is the report's own sections as anchored groups
with a sticky section index and counts. Rows become mention cards: source mark (a small glyph per channel and a
monogram for the outlet - no third-party logos fetched or bundled), outlet and time, headline, a two-line excerpt,
figures (outlets that carried it, Facebook reach, interactions and growth since yesterday), tone, the layer that
collected it, and Pin / Set aside / Open as icon buttons with text labels available to assistive technology and on
hover. Pinned cards carry a clear mark and gather in a "In the report" tray. A Cards / Table switch keeps today's dense
tables for people who want them, and the density setting still applies. The rail holds: volume over the window by
channel (stacked bars), the desk's issues against their baseline (bars with the baseline marked), tone split, and
Upcoming as a short dated list. Charts have a text alternative and a table view, and no chart uses colour alone.

**5. Brief.** A document, not a form. A centred page-like surface in a readable measure (about 70 characters), section
headings as headings, the ratings as labelled segmented controls at the top, and each section an editor that grows
with its text. Citation ids render as small numbered chips; hovering or focusing one shows the cited row, and clicking
opens it in an evidence panel beside the page. "No evidence behind" and "figure not in the cited row" become inline
marks on the sentence with the explanation in the margin, never colour alone. A quiet status line says saved / unsaved
/ saving / conflict at all times. History and Compare open in a side sheet; Compare is a readable two-colour diff with
insertions and deletions also marked by underline and strike. The export actions sit together as one "Get it out" menu
with the Copy for the document action as the default. If you move the brief off plain textareas, the localStorage
working copy, save on blur, the conflict flow and every case in `tests/den-browser.mjs` and
`tests/den-inject-browser.mjs` still hold; if you cannot guarantee that, keep textareas and style them as a page.

**6. Watch.** Proposals as review cards: the candidate, why it was proposed, its evidence rows, its score as a small
meter, and Preview / Approve under an issue / Dismiss with a reason. Preview opens in a side sheet with the counts by
channel as a chart and the sample rows. The register is a searchable, filterable table with state shown as a status
dot and a word.

**7. Collection.** A health board: one card per channel with a status (delivering / nothing delivered and why / off /
paused at a verification / not granted), how it is read, the last delivery, the last day and seven days with a
sparkline, and Collect now. The job console becomes a docked drawer that survives switching areas. The recall result
from the back-test, when present, is the headline figure of the area; when absent it says that it has not been run
and what runs it.

**8. Options.** A settings page with a section index, grouped fields with help text, proper switches, a drag-and-drop
(and keyboard-operable) order for the report's sections, and an explicit Save bar that appears only when something
changed.

**9. The system underneath.** Build these once in `docs/den.js` / `docs/den.css` and use them everywhere: Button
(primary, secondary, quiet, danger, icon), Menu, Select, Segmented, Switch, Tabs, Card, StatTile, Badge, Tag, Meter,
Sparkline, BarChart, StackedBar, Table, Sheet, Dialog, Toast, Tooltip, Skeleton, EmptyState, ErrorState, Banner. An
icon set drawn as inline SVG in one file. A type scale of five sizes with body at 14 px, a 4 px spacing scale, three
elevation steps, radii of 6 / 10 / 14, motion of 120-200 ms with one easing and `prefers-reduced-motion` honoured.
Skeletons replace "Loading the checks" text but keep an `aria-live` sentence. Add a Den section to
`docs/styleguide.html` showing every component in both themes.

## How to run the work

**Phase 0 - look.** Take the "before" screenshots. Study the reference. Write, at the top of `DEN.md` s.8, what you
saw in the reference, what you are taking and what you are leaving.

**Phase 1 - three directions, then stop.** In `design/prototypes/annes-den-concepts/` (the convention of
`design/prototypes/creative-studio-concepts/`: static HTML on invented rows, a shared stylesheet, an index page,
screenshots in `shots/`), build the Today and Brief screens three ways that really differ - for example a light
editorial workspace, a dark command desk, and a rail-and-feed product layout - each at 1366 x 768 in both themes where
it has both. **Show the owner the screenshots and stop for a choice.** Taste is theirs; do not build the whole page on
a guess.

**Phase 2 - tokens and components.** Tokens, the component set and the styleguide section, with no change to the
live page yet.

**Phase 3 - the page, one area at a time.** Frame and header, the figures and Needs attention, Today, Brief, Watch,
Collection, Options. After each area run the Den harnesses and retake that area's screenshots.

**Phase 4 - finish.** Bump the page release query for `den.js` and `den.css` in `docs/index.html`, update `DEN.md`,
`CLAUDE.md` and the header comment of `den.css`, and save the "after" set beside the "before" set.

## Proving it

- `node tests/run.mjs all` passes. The Den harnesses keep at least their present counts: `tests/den-worker.mjs` (17),
  `tests/den-browser.mjs` (24), `tests/den-inject-browser.mjs` (60), `tests/den-tools-test.py` (54). A test is changed
  only because the markup it reads changed, never to make a failure go away, and each such change is listed in your
  report. Prefer keeping the roles, labels and ids the harnesses select on.
- New browser cases: both themes; Cards and Table give the same rows in the same order; every tile opens its rows;
  each chart has its table; the section order can be changed by keyboard; the first row of Today is visible without
  scrolling at 1366 x 768 with the attention band collapsed and with it open; no horizontal scroll at 1024.
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
