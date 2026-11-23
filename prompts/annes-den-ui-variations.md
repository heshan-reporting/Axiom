# Anne's Den: four UI concepts, then one in production

You are working in the AXIOM repository. Read `CLAUDE.md` (the section "The monitoring desk and Anne's Den" and
"The interface (Phase 5)"), `DEN.md` s.0 and s.6, `docs/den.js`, `docs/den.css`, `docs/ax-ui.js`,
`tests/den-browser.mjs`, `tests/den-inject-browser.mjs`, `tests/den-fixture.mjs` and
`design/prototypes/creative-studio-concepts/README.md` before you design anything.

## The job

Anne's Den (`#v-den`, React island `docs/den.js`, 547 lines; styles `docs/den.css`, 89 lines) works and is fully
tested, but it looks and flows like an admin tool. Redesign it as a premium analyst product. Deliver **four genuinely
different concepts as clickable prototypes**, stop for the owner to choose, and only then build the chosen one into
production. Do not touch `docs/` in phase 1.

The person using it files two cited reports of 4,000 to 5,000 words every morning (AEP national and AEP Victoria,
24-hour windows) and three weekly ones. The standard she is held to is "relevance and nothing critical missed, before
volume". Her loop is: open a desk, read the strip of six model-free checks (collection gaps first), triage the
window's rows (pin, set aside with a reason, mute), draft the brief (one model call), edit it section by section with
every sentence tied to an evidence id, set the ratings, file it, export it.

## What is wrong today (the audit: from the code, then checked against captures)

The current UI is captured in the ignored `tests/shots/den/` (each tab at 1366 x 768 and 1920 x 1080, taken on
13 November 2026 with `node --experimental-sqlite tests/den-shots.mjs`). Read them first; they are your "before". If
the folder is empty, run the script (on Node 26 `npx playwright install` hung while unpacking: the headless shell
build was fetched by hand into `~/Library/Caches/ms-playwright/chromium_headless_shell-1194/`).

Seen in the captures:
- **At 1366 x 768 no evidence is on the first screen.** The app's masthead, the view title, a navigation that wraps
  to two lines, the scope bar and "About this view" take about 255px; the desk header 70px; the strip with four
  signals 250px; the tabs sit at 613px; the first panel is an empty Key narratives; the first media row is below
  the fold. On Brief at 1920 x 1080 the first textarea starts at about 745px.
- **The scope bar is shown and the Den ignores it** (`useScope` is not used): six selects that do nothing here.
- **The strip costs the same 250px on every tab**, Collection and Options included.
- At 1920 the content is a 1400px column with 260px of empty ground either side, and each row's actions (Pin, Set
  aside, Open) sit about 1,200px to the right of the headline they act on.
- Every row and panel has the same weight: a 362-reaction story and four "noisy outlet" rows look identical; the
  `subscriber` chip, the `Draft` chip and the `Not collected` chip are the same outlined pill in different inks.
- The flag "No evidence behind: ..." is small orange text under the textarea, away from the sentence it is about.

So every concept must decide what the Den does with the app chrome. Consider a focused mode in the manner of
`body.in-studio` (the app's navigation and scope bar step aside, with a way back), or a compact header; say which and
why. The first evidence row, or the section being written, must be on the first screen at 1366 x 768.

Flow:
1. **Evidence and the brief are separate tabs.** Writing a cited section means Alt+1 / Alt+2 round trips. The brief has
   no evidence pane, pins are invisible on the Brief tab, and the uncovered strip signals only appear in a dialog at
   filing.
2. **Citations are bare ids** (`M:123` chips with the label in a tooltip). Nothing on a row inserts its id into the
   brief; clicking a citation opens the external link, not the row.
3. **Today is five stacked full-width tables** with no filter, sort, search, section navigation, pinned-only view or
   bulk set-aside. Every pin or set-aside reloads the whole board. Narratives and Upcoming cannot be pinned.
4. **The brief is 9 to 11 plain textareas in one long column** at the full 1400px width: no outline, no reading
   measure, no word count, ratings at the top, save / file / export at the very bottom and not sticky.
5. **Drafting progress is a button label** ("Drafting (a minute or two)..."): no stages, no elapsed time, no evidence
   count before the spend. One shared `busy` value disables unrelated buttons.
6. **The strip is repeated above every tab** as a plain list that looks like any other panel; a gap's reason and fix
   are on another tab; items that open other views leave the Den with no way back.
7. **Watch** nests a second tablist, reviews proposals as a table with expansions inside a cell, has no keyboard
   support or batch decisions, and deletes through `window.confirm`.
8. **Collection** is seven blocks mixing daily status with rare configuration; the console sits away from the button
   that started the job.
9. **No multi-desk view.** The desk control is a select with no "filed today?" state across the five desks, and no
   day picker although the routes take `to=` and `hours=`.
10. **1920px is unused**: Today and Brief are single column at every width.

Visual:
- One ink (`--t2`) carries labels, sub-lines, chips, notes and empty states; `--t3` is never used. Four near-identical
  sizes (11 to 12.5px), 9.5px uppercase mono labels, 10px chips.
- No page hierarchy: a 20px h2, then every panel title at 10.5px. The strip, panels and notices share one border,
  radius and fill.
- Panels are a 3% alpha fill with 8% alpha borders on `#0B0F16`: they barely separate from the ground. No elevation,
  even on the dialog.
- Status is outline-only pills and 2px left borders. The `-dim` tints, `--x-info`, the type scale, the space scale,
  the radius scale, elevation and motion tokens in `docs/axiom-ds.css` are all unused. No icons, no skeletons.
- One button class (`.den-mini`, 26px) does 67 jobs. Many layout values are inline `style=` in `den.js`.
- Dark only, one breakpoint, no motion at all, four classes used in `den.js` with no CSS.

## Phase 1: four concepts (prototypes only)

Create `design/prototypes/annes-den-concepts/` following the Creative Studio concepts folder: `index.html` (the four
side by side with a one-paragraph rationale each), `concept-a.html` to `concept-d.html`, `shared.js` (the synthetic
data and state machine), a stylesheet per concept, `shots/`, `README.md`. Rules: isolated from production, loads
nothing from the app, talks to no worker, model or key, **works from `file://`** (the sandbox may refuse local port
binding), fonts and icons inside the folder (no CDN), and **invented data only** - a synthetic client with synthetic
desks, outlets, narratives and posts. Den reports are client material: no client name, report sentence or real
account appears anywhere.

Build the shared data and state machine first, yourself. Then deploy four agents in parallel, one per concept, each
briefed with this file, the shared data contract and its concept below. A fifth agent reviews all four against the
acceptance list and reports defects; fix them before you stop.

The four must differ in **information architecture and in visual language**, not in colour alone:

**A. The Storyboard** - organised by the report, not by the channel. The brief's sections are columns on a board
(Key Narratives, Traditional Media, Social, Influencer and Political, Risks...), each holding the evidence assigned
to it as compact cards; an "Unsorted" column on the left is the window's triage queue. Triage is assigning: drag a
row, or press a section's number, and it is pinned to that section; set aside is a key. Opening a column turns it
into that section's writing surface with its own evidence beside the text, so a section is drafted from exactly what
was filed under it. Each column shows its count, its uncovered checks and its state (empty, has evidence, drafted,
edited, flagged). Look: a studio pinboard done with restraint - deep slate ground, raised cards with real elevation,
a colour per section used sparingly as a spine, confident sans display.

**B. The Front Page** - the window is laid out like an edition, ranked by weight instead of listed by table. A lead
item (the heaviest story or spike) at display size with its outlets, reach and growth; a second tier of three or
four; then a dense "in brief" list for the rest and a collapsed noise drawer for what scores low. Collection gaps
run as a banner across the top of the edition, never as a quiet column. Weight is computed from what the board
already returns (outlets, interactions, growth since yesterday, a check that names it), and shown, so the ranking is
explainable. The brief opens as a facing page: edition left, report right. Look: editorial and typographic - a serif
display face with a grotesque for data, generous leading, rules and columns rather than boxes, light theme first with
a true dark.

**C. The Reading Room** - a reader, because today every row opens in another tab. A narrow list of the window on the
left (channel facets, weight, unread / read / pinned / set aside), and a large reading pane that shows the item
itself: the article's held text or the post, its outlets and syndicated copies, interactions over time, the tone of
held comments, the checks that name it, where it has already been cited. From the pane: Pin, Set aside, "Use in
<section>" (inserts the citation), next / previous by key. The brief is a third pane that slides in beside the
reader. Watch proposals and Collection use the same list-and-pane shape, so the whole Den is one pattern. Look: calm
focus tool - soft neutral dark, one warm accent, large comfortable reading type in the pane and small precise type in
the list, subtle depth between the three planes.

**D. The Clock** - time is the spine. A horizontal 24-hour (or seven-day, for weekly desks) timeline across the top
plots the window: volume by channel as stacked bars, Sentinel spikes, first-seen actors and outlier posts as marks,
collection gaps as hatched spans where a channel delivered nothing, upcoming actions to the right of "now". Brushing
a span filters everything below it; a mark opens its row. Below, the evidence as one stream in time order with
channel lanes, and the brief docked to the right. Yesterday's window can be overlaid for comparison, and the day
picker the routes already support (`to=`, `hours=`) is the timeline itself. Look: premium data instrument - near-black
ground, luminous but disciplined data colour, mono figures, fine grid lines, charts drawn as carefully as the type
(load the `dataviz` skill before drawing them).

Every concept must cover, with real interactions on the synthetic data:
- the header (desk, window, day, model calls today, read-only state), the six checks with gaps leading, triage (pin,
  set aside with a reason, the mute offer, put it back), the brief (draft, hand edit, citations, flags, regenerate a
  section, ratings, save states, conflict Keep mine / Take theirs, filed and reopen, the "before it is filed" list,
  the four exports, history and compare), Watch (proposals with preview, approve under an issue, dismiss with a
  reason, the register by kind, add), Collection (channels, what delivered, collect now with the console, switches,
  parliament pages, petition counters, recall) and Options;
- **every state**: loading (skeletons), empty-with-why and the one action that fixes it, error-with-retry, a busy
  database, a dropped connection mid-draft, read-only key, a filed brief, a collection gap (never shown as a quiet
  day);
- a **design system page** inside the concept: colour tokens for dark and light with their contrast ratios, the type
  scale, spacing, radii, elevation, motion with a reduced-motion rule, and the component set (button hierarchy with
  at least primary / secondary / quiet / danger / row action and real hit sizes, chips with fills, table and list
  rows, form fields, notices, dialog, drawer, console, stepper or rail, skeleton, toast);
- keyboard: j/k, p, x, o, 1-5, Alt+1-5, ?, Ctrl/Cmd+S, Esc, with visible focus;
- WCAG AA text contrast, no serious or critical axe finding, no horizontal overflow at 1366 x 768, 1440 x 900 and
  1920 x 1080; desktop first (phone is out of scope).

Phase 1 ends with: screenshots of each concept at 1366 x 768 and 1920 x 1080 for Today-equivalent, Brief-equivalent,
Watch, Collection and the design system page in `shots/`; the comparison `index.html`; a table in `README.md` of how
each concept answers the ten flow problems above, what it costs to build into production (which tests change), and
your recommendation. **Stop there and ask the owner to choose** (one concept, or a named mix). Commit the folder on a
new branch `claude/annes-den-concepts`; do not merge.

## Phase 2: the chosen concept in production (only after the owner chooses)

Constraints that hold whatever is chosen:
- No worker change is needed for layout. If the concept wants something the routes do not give (for example a
  multi-desk status read), propose it, do not improvise it. Today must still make exactly one
  `GET /den/board?desk=&missed=1` and no `/den/missed`.
- The house rules still bind the data and the words: tokens not hex, every panel has loading / empty-with-why /
  error-with-retry / read-only, a gap is never a quiet day, nobody unregistered is named, the Source List is built
  from citations, every paid button states its cost, Australian Eastern time. The richer skin is scoped to
  `#den-root` the way `docs/studio-skin.css` scopes itself to `#studio-root` (re-point the app tokens inside the
  root; nothing outside changes). Fonts are vendored under `docs/vendor/fonts/`, not a CDN.
- `tests/studio-tokens-test.mjs` covers `den.css`: no hex outside a token declaration, no pixel radius outside a
  token, a reduced-motion rule in any animating stylesheet. Its glob is `^(studio.*|den)\.css$`: keep the styles in
  `den.css` or extend the glob, and extend its AA check to the Den's token pairs.
- Selectors the three browser harnesses depend on stay, or change together with the test in the same commit:
  `#den-app[data-density]`, `.den-head select[aria-label="Desk"]`, the tablist and `#den-tab-<id>` / `#den-tabpanel`,
  `.den-strip` with gaps first, `section.den-panel[aria-label=...]` with the exact panel names, `tr.den-row` (rows
  are table rows and focusable), `.den-sec[data-section]` with its textarea, `.den-bar[role="status"]`,
  `.den-state(.err)`, `.den-notice`, the dialogs' labels, the field labels, the button names the keyboard shortcuts
  and `getByRole` match, localStorage `ax_den_work_<brief>`, `ax_den_desk`, `ax_den_tab`, `ax_den_strip`.
  A side-by-side layout is compatible with all of this. Where a concept truly needs a different structure, change the
  test with it and say which assertions moved and why.
- Test first: each behaviour change gets a failing case in `tests/den-browser.mjs` or
  `tests/den-inject-browser.mjs` before the code. All of `den-browser` (27), `den-inject-browser` (60),
  `den-worker`, `studio-tokens-test` and `asset-versions` pass at the end, with axe at 1366, 1440 and 1920 for a
  full and a read-only key.
- Bump `den.css?v=` and `den.js?v=` in `docs/index.html` and run `node tests/asset-versions.mjs --write`. Move the
  inline `style=` layout values in `den.js` into the stylesheet. Update `tests/den-shots.mjs` and save matched
  before / after captures into the ignored `tests/shots/den/`.
- Update the Anne's Den entry in `CLAUDE.md` and `DEN.md` with what changed. Commit on a `claude/` branch and push;
  never push to `main`, never deploy the worker.

## Report at the end of each phase

What was built and where, what was verified and how (tests run with counts, screenshots taken, and for each concept
how many pixels down the first evidence row sits at 1366 x 768 against today's 613px tab line), what was not verified
(nothing here can be seen against the live worker), and the decision you need from the owner.
