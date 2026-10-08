# Claude prompt: AXIOM Creative Studio S23 - a commercial-grade studio, proven

How to use: open a new Claude Code session on `heshan-reporting/Axiom`, branch
`claude/peaceful-gates-g1t4ss`, and paste everything below the line. `CLAUDE.md` loads by itself and is
the system's reference manual; this prompt says what to do with it. Written on 8 October 2026 from an
audit of build `2026-10-08.studio-p38` (page `?v=r16`).

---

## Your role and the bar

Act as the senior engineer, software architect, front-end developer, UI architect, UI engineer and
product designer for AXIOM's Creative Studio. The Studio is where an Australian political
communications agency turns a brief or a breaking situation into on-brand social creative for named
clients (MCA, AEP and others), with approvals and private client review.

Your job in this session: take the Studio from "carefully engineered and working" to a product that
feels as finished, fast and trustworthy as the best commercial creative tools (Canva, Figma, Adobe
Express, Microsoft Designer, Google's and Apple's own apps). Keep what makes AXIOM different: brand
rules that hold, measured validation, claims traced to sources, client isolation, approvals of exact
versions, and honest progress.

The bar is "bug-free in front of a client". The absence of bugs cannot be proven, so the bar is met
by evidence:
- every defect you find is reproduced by a test that fails first, then fixed, and stays fixed;
- every journey runs green in three browsers with zero console errors;
- every long wait shows real information that changes while the user waits;
- everything you claim is backed by something the owner can look at.

Anything you cannot prove goes on a "not proven" list. Do not claim it.

## 1. Where things stand (verify, do not assume)

**Frontend.** GitHub Pages serves `docs/` from `main`. The Studio is a React 18.3.1 island written
with htm (no build step; React, ReactDOM and htm are vendored in `docs/vendor/`).

| File | What it holds |
|---|---|
| `docs/studio.js` (668 KB, 3,792 long lines) | `StudioApp`, `AssetView`, `LayoutEditor`, `CreativeDirector`, `WorkspaceActivity`, `DesignDock`, `BoardView`, `CopyStage`, `ReviewStage` and about 60 more components |
| `docs/studio-guided.js` | the wizard, `ProcessingCard`, Objectives, Strategy, the Directions board |
| `docs/studio-editor.js` | `STEditor`: handles, snapping, toolbar, font picker, shortcuts |
| `docs/studio-render.js` | `STRender`, the one renderer for preview and export: measure, validate, repair, variants, styles. Its RULES block is byte-identical with the worker's. |
| `docs/studio-progress.js` | `STProgress`, the job model |
| `docs/studio-merge.js` | `STMerge`, the three-way merge |

Styles are about 174 KB across six files: `studio-shell.css` (the one authority for the frame),
`studio-skin.css`, `studio-guided.css`, `studio-flow.css`, `studio-editor.css` and
`studio-progress.css`. More rules sit inline in the 675 KB `docs/index.html`. Scripts and styles carry
`?v=r16`.

**Backend.** The Cloudflare Worker `axiomworkerv4.js` (17.3k lines, pure ASCII) runs on D1, R2, KV,
Vectorize and Workers AI.
- The Studio lives under `/studio/*`.
- Durable jobs (`studio_jobs`): `stJobRun` and `stStageRun` handle claim, lease, fence, live
  `progress.activity`, cancel and retry.
- Since S22 every Claude call streams (`stClaude`, `stSseRead`). The activity carries `thinking`,
  `written` and `streamAt`; the lease beats every 30 s; there are limits for a silent stream (idle),
  a stream that ends early (cut) and a total cap.
- `POST /studio/job/step` sends whitespace heartbeats (`stStepRespond`).
- Image generation (`stRenderJob`, `nanoRender`, Gemini) is not streamed.

**The guided flow (S17-S20):**
1. Wizard.
2. Brief: Understanding, Objectives, Strategy.
3. Explore: directions.
4. Copy.
5. Design: the canvas editor, the production mode (Editable or Full AI), imagery.
6. Review & Deliver: preflight, approvals, the client review link, the delivery package.

The server enforces the order (`stWorkflow`, `stWfGate`). The page never moves on its own.

**Release state.** Build p38 is on `main`. Ask the owner whether the worker deploy finished: `GET
/engine/status` must report `studio-p38`. The sandbox cannot reach the live worker.

**Tests.** `npm test` runs `tests/run.mjs check|backend|browser`: 22 checks, 58 backend harnesses
(the worker in-process over SQLite, every provider mocked) and 41 Chromium harnesses. All are green at
p38.
- `tests/worker-env.mjs`: the backend fixture.
- `tests/studio-fixture.mjs`: the browser fixture.
  - `setProvider('claude'|'gemini', 'ok'|'slow'|'down'|'missing'|'stream')` switches a stub's
    behaviour.
  - `failNext(re, status, body, {after, abort, detach})` makes the next matching request fail.
  - `hold(re)` keeps matching requests waiting until released.
- `tests/studio-flow.mjs`: wizard and phase helpers.
- `tests/studio-s18-seed.mjs`: projects seeded at every stage.
- Screenshots: `tests/studio-s20-shots.mjs <label> [sizes]`, written to the git-ignored
  `tests/shots/s20/`. Contact sheets: `tests/studio-s20-sheet.mjs`.
- Performance: `tests/studio-s20-perf-browser.mjs`.

Not yet in place: WebKit and Firefox runs, automated accessibility audits (axe), pixel-diff visual
regression, a fail-on-console-error rule across all suites, and recorded videos.

**Known limits.** Read the "Limits" parts of `CREATIVE-STUDIO.md` s.40-45 before changing anything.
They include:
- handles appear for one layer at a time (a multi-selection is not scaled as one);
- a turned layer snaps by its box;
- image edits are by description, not by mask;
- one draft per person per asset;
- the legacy views inside the island were never redesigned (Sources, Sequence, Recipes, the Brand
  workspace's long tables);
- the phone layout is cramped;
- live model behaviour was never proven in the sandbox.

## 2. What an audit of build p38 found (reproduce each, fix it, and add what you find)

Start by regenerating the screens:
`node --experimental-sqlite tests/studio-s20-shots.mjs before 1440,1920,1024,390`.

**Seen on screen**
1. Two status overlays stack in the same place at the bottom of the stage: the Creative Director's
   "reviewing this version" line and the crop-mode hint ("drag to reposition the photograph; wheel
   to zoom").
2. What matters gets truncated:
   - the asset name in the canvas bar ("Faceboo...");
   - the crop bar ("Reframing the photograph drag to mo...");
   - the facts line under the canvas;
   - the readiness explanation;
   - at 390 px, the dock's MODE label and the readiness strip.
3. The Creative Director panel opens scrolled into the middle of a review: its title and first score
   rows are cut off. Scroll position is not reset when the asset, version or tab changes.
4. At 390 px a floating "Properties and Creative Director" button covers the readiness strip.
5. Developer language is on screen:
   - layer ids as the subject of an issue ("panel, hl, sp, cta");
   - model ids ("gemini-3-pro-image 2K") and "fallback fonts";
   - raw confidences ("confidence 30%");
   - "Argument diversity 0.95 / Composition diversity 0.75 ... 1 = nothing in common";
   - "Words it read: none";
   - uppercase monospace fact lines.
6. Paragraphs of explanation sit where controls should be. Properties explains framing and subject
   detection in prose; Checks and the Creative Director explain their own scoring at length.
7. The project library is a grid of text cards: no thumbnail of the work, no search, no filter or
   sort, and status only as a monospace chip.
8. Explore shows every direction twice: a row of small previews, then large text cards with the same
   content. The previews are small, dark and mostly empty.
9. The Design toolbar crowds two rows:
   - row one: views, the asset name, zoom, Fit, Guides, Preview, full screen, More, Continue to
     Review;
   - row two: Undo, Redo, Add, a hint, View, ?.

   Selection handles are small squares at only some corners.

**Missing from a commercial editor (from the code)**

10. Editing gaps:
    - no right-click or long-press context menu;
    - no drag from a panel onto the canvas (Add inserts at a fixed place);
    - no dropping files from the desktop (uploads are file pickers only);
    - no paste of images or text from the OS clipboard (copy and paste go through localStorage);
    - no copy and paste of style;
    - no rulers or user guides;
    - no distance or equal-spacing indicators while dragging;
    - a multi-selection cannot be scaled or rotated as one;
    - no panel listing the undo steps by name (the History tab lists saved versions only);
    - the page strip cannot add, duplicate, reorder or delete pages (carousels).

**Waiting gaps**

11. Waits that show too little:
    - three model calls still run inside the request with only a busy line:
      - `POST /studio/suggest` (`stSuggest`);
      - reference analysis on upload and `POST /studio/reference/analyse` (`stRefAnalyse`);
      - `GET /studio/brief/suggest?ai=1` (`stBriefSuggest`);
    - `POST /studio/source/url` reads a web page in the request (several seconds) behind one line;
    - image generation shows only "Imagery generating" and dashed sketch boxes, for a minute or more;
    - streamed model calls show character counts but none of the content already written;
    - only analyse, direct and copy have the step checklist. Concepts, revise, inspect, kit,
      sequence, strategy and render show a one-line phase label.

**Engineering hazards**

12. Code risks:
    - `docs/studio.js` is one 668 KB file with no `React.memo` (14 `useMemo`, 14 `useCallback`);
    - measurement and variations run on the main thread (chunked since S21, never off-thread);
    - there are no error boundaries: one render error can blank the whole Studio;
    - `studio-shell.css` has 13 `!important`;
    - animation keyframes are spread over five files.

## 3. Rules that hold throughout

- **Branch and release.** Work on `claude/peaceful-gates-g1t4ss`. Commit in small, reviewable slices
  and push after each green slice (`git push -u origin claude/peaceful-gates-g1t4ss`). Do not merge to
  `main` and do not deploy. When everything is proven, ask the owner to say "go live". The worker is
  deployed from the owner's laptop with `tools/deploy-worker.sh`.
- **Spend nothing.** Never call Anthropic or Gemini for real from the sandbox (it has no egress
  anyway). Every harness mocks providers. Anything that needs a live model is delivered as a script
  the owner runs with an explicit spend cap, and is labelled "not proven live" until they do.
- **House rules from `CLAUDE.md`:**
  - the worker stays pure ASCII;
  - nothing private goes in `docs/` (Pages publishes it);
  - secrets stay in Cloudflare;
  - the RULES block stays byte-identical in `axiomworkerv4.js` and `docs/studio-render.js`;
  - `docs/studio-shell.css` stays the one authority for the frame;
  - bump `AXIOM_BUILD` and every `?v=` on a page release;
  - no model identifiers in commits.
- **Contracts earlier releases set, with their tests:**
  - data safety (S19/S20): the working copy outside the editor, op ids, guarded draft discard, the
    three-way merge with a person deciding conflicts, the lock contract;
  - approvals of exact versions;
  - client isolation;
  - honest progress: no percentage invented from the clock;
  - the page never navigates on its own;
  - mandatory mark rules;
  - the measured validation contract.
- **Every defect** gets a test that fails before the fix and passes after, committed with the fix.
  Never weaken a test to make it pass. If an expectation was wrong, say why in the commit.
- **`npm test` stays green** after every slice. Run suites one at a time: `tests/studio-browser.mjs`
  is sensitive to concurrency.
- **Plain English on screen.** Ids, model names, raw scores and confidences go behind an "About this"
  disclosure, never in the main line.

## 4. The programme

Work in this order. If the session cannot finish everything, finish whole phases in order and report
the rest as not done. Never leave a half-built feature reachable in the UI.

### Phase 0 - Baseline (commit as "S23 baseline")

- Run `npm test` and record the counts.
- Capture before screenshots of every stage and state at 1440x900, 1920x1080, 1024x768 and 390x844.
  Include the states the shot script lacks: waiting states, errors, empty states.
- Record Playwright videos (mocked providers) of the full guided journey and of an editing session.
  These are the "before".
- Build the wait inventory. For every user action in the Studio, record:
  - the request it makes;
  - its mocked duration;
  - its live worst case, cited from the code (model, `max_tokens`, timeouts);
  - what the screen shows meanwhile.

  Commit it as a table in `CREATIVE-STUDIO.md` s.46.
- Add a console guard to the browser fixture. Any `pageerror`, `console.error` or unhandled rejection
  fails the harness unless it is expected by name.

### Phase 1 - Bug sweep

- Reproduce and fix audit items 1-9, and everything Phase 0 surfaces.
- Hunt systematically:
  - **Canvas monkey test.** Seeded random sequences of select, drag, resize, rotate, type,
    undo/redo, group, align, delete, switch asset and save. It must assert that nothing throws, undo
    returns the exact layout, nothing is lost, and no selection goes stale.
  - **Network fault injection** on every Studio route: slow, 500, 409, dropped connection, cut body.
    The page must explain and recover.
  - **Races:** double clicks, switching asset or stage mid-request, two tabs on one asset.
  - **Long-session memory check:** object URLs revoked, listeners and timers cleaned, heap steady over
    200 actions.
- Keep a bug ledger in `CREATIVE-STUDIO.md` s.46: id, symptom, repro, root cause, fix commit, test
  name.

### Phase 2 - Waiting that never looks stuck

The goal, measured by the tests below:
- within 300 ms of any action, something visibly responds;
- within 1 s, any longer operation says what it is doing;
- while it runs, something on screen changes at least every 3 s;
- nothing shows a share it cannot count.

**Partial results while a model writes.**
- Every Studio model call already streams (S22). In the worker, parse the streamed JSON as it grows,
  with a small tolerant partial-JSON reader that closes open strings and brackets. Fuzz it at every
  truncation point of real fixtures.
- Publish a bounded `progress.partial` (at most 8 KB) holding the sections already complete:

  | Stage | What appears as it is written |
  |---|---|
  | The reading | the situation, the summary, objective titles, strategy names |
  | Directions | each direction's name, idea and headline |
  | Copy | each channel's headline and supporting line |
  | Concepts | each concept's name and summary |

- The page shows them as drafting cards that fill in, marked "still being written". The validated
  result replaces them when the job ends.
- Partial content is never actionable (no select or apply) and never saved as a version.

**Images.**
- While a render runs, show what is being made:
  - the art direction in plain words;
  - the reference thumbnails in use;
  - the composition with an animated placeholder inside the exact image region, with the words and
    marks already drawn over it;
  - elapsed time against the typical time (from the durations in `/studio/status`);
  - Cancel.
- Check the Gemini API documentation for whether the image model in use can stream interim (thought)
  images. Adopt it only if it is documented for that model, behind a flag, with a test. Otherwise say
  so in the report.

**Synchronous calls.**
- Move `/studio/suggest`, reference analysis and `/studio/brief/suggest?ai=1` onto the job system, or
  onto streamed answers with progress. Keep their route contracts for existing callers.
- Give `/studio/source/url` staged feedback: fetching, reading, N paragraphs found.

**Every stage** gets a processing card or activity line with real steps: concepts, revise, inspect,
kit, sequence, strategy and render, not only analyse, direct and copy.

**Background work.**
- The user can keep working while jobs run, and a jobs tray shows each job's live state.
- When a job finishes in the background:
  - a toast shows the result, with a button to open it;
  - the tab title and favicon show a count;
  - if the user agrees once (opt-in), a desktop notification appears while the tab is hidden.
- Never navigate on your own.

**Stalls.**
- When nothing has changed for a stage's expected interval, say so plainly, show when the model last
  sent anything, and offer the real choices: keep waiting, retry, or cancel.
- When the connection drops, reconnect to the job (the S22 `runJob` path) and say that it did.

**Acceptance.**
- A browser test per long operation, using the streaming and slow stubs, asserting:
  - first feedback within 300 ms;
  - a described state within 1 s;
  - visible change at least every 3 s;
  - partial cards appear, then are replaced by the final result;
  - no percentage without counts.
- A fuzz test for the partial parser.

### Phase 3 - A Canva-class editor, built for this product

Each item below needs its own tests.

- **Elements panel (left).**
  - Contents:
    - text styles: heading, subheading, body, label, quote, CTA;
    - shapes, lines and arrows;
    - icons, with search;
    - frames: image placeholders a photo can be dropped into;
    - brand: logo and wordmark variants under the campaign's policy, brand colours, brand fonts,
      approved facts as text blocks;
    - uploads.
  - Click adds an element at the visible centre. Drag places it at the drop point, with a ghost
    preview and snapping.
  - Files dragged from the desktop onto the canvas upload and place. Images and text pasted from the
    OS clipboard land on the canvas.
- **Context menu** (right-click, long-press on touch, Shift+F10): cut, copy, paste, duplicate,
  delete, copy style, paste style, lock, hide, bring forward / to front, send backward / to back,
  align to page, group/ungroup, rename, "ask the Creative Director about this".
- **Multi-selection transforms as one:** one bounding box, scale and rotate together, Shift
  constrains, Alt scales from the centre.
- **Smart guides.**
  - Edge and centre alignment, equal-spacing markers, and live distances in output pixels while
    dragging.
  - Hold Alt to measure from the selection to any layer or to the page edge.
  - Rulers and draggable guides (a toggle, remembered).
- **Text:** an auto-fit (shrink to box) toggle, text style presets from the brand, line height,
  letter spacing, case, alignment, and spellcheck while typing on the canvas.
- **Colour:** one picker with brand colours first, then colours in this design, recent colours, hex
  input, the EyeDropper where the browser has it, and a live WCAG contrast ratio against what is
  behind the text.
- **Images:** double-click any image or frame to crop and reframe inside its frame (not only the
  background); replace an image by dropping a file on it; filter presets beside the adjustments.
- **Pages:** the page strip adds, duplicates, reorders (by drag) and deletes pages for carousels,
  each page a version of its asset family, with the same validation.
- **View:**
  - Space+drag pans;
  - Ctrl/Cmd+wheel and trackpad pinch zoom;
  - a zoom slider and zoom to selection;
  - touch pan and pinch on tablets.
- **History panel:** named steps from the existing undo stack; click a step to go back. The
  autosave state is always visible.
- **Brand guardrails inline:** an off-brand colour or font shows a quiet chip with a one-click "use
  the brand's". Rule-held marks stay held (S5/S6).
- **Performance** with 50 layers, on the perf harness (report the machine):
  - drag: p95 frame time at most 16.7 ms;
  - input-to-paint at most 50 ms;
  - no long task over 100 ms during a drag.
- **Keyboard parity:** the Canva and Figma shortcuts people expect, listed in the shortcuts sheet and
  shown in tooltips.

Keep AXIOM's model: every edit becomes a layout version on save, drafts autosave for the person, and
locks and approvals behave as they do today.

### Phase 4 - Visual system and motion

- **Tokens.** One token source for the Studio: colour, type scale, spacing, radius, elevation,
  z-index, motion durations and easings.
  - Dark theme, plus a light theme the user can opt into (remembered). Both meet WCAG AA.
  - Visible focus rings everywhere.
- **CSS.**
  - Consolidate the Studio's CSS with cascade layers (`@layer tokens, base, components, frame,
    utilities`).
  - Remove `!important` unless a third-party rule forces it, and explain each one you keep.
  - Keep `studio-shell.css` as the frame authority.
  - Delete dead rules, found with Playwright CSS coverage across all journeys.
- **Components.** One small component set used across the Studio: buttons, inputs, selects,
  segmented controls, tabs, chips, toasts, dialogs, popovers, tooltips, skeletons, progress, empty
  states. Document it in `docs/styleguide.html`.
- **Motion that explains state.**
  - Panels and sheets enter from where they live; list items stagger in.
  - Selection handles appear with a short scale.
  - A finished job's result arrives with a gentle highlight.
  - Skeletons shimmer while loading.
  - Durations are 120-240 ms with standard easing.
  - All of it switches off under `prefers-reduced-motion`. Nothing moves on the artwork itself.
- **The library:**
  - visual project cards with a thumbnail of the latest composition (drawn by `STRender`, or the
    saved export);
  - status and next step at a glance;
  - search, filters (client, campaign, status, owner), sort, and recent work;
  - keyboard navigation and real empty states.
- **Wording.** Rewrite every on-screen string that shows ids, model names, raw scores or internal
  jargon (audit item 5). Keep the detail in "About this" disclosures, and keep the Studio's honest
  voice.
- **First run.** A short, skippable guide through the five phases, and tips the first time someone
  uses the canvas.

### Phase 5 - A smoother flow

- **Rapid response.** A "Respond fast" path from the library:
  1. Paste text or a link.
  2. Axiom reads it.
  3. Axiom's recommendation is pre-selected, visibly, with one click to change it.
  4. Directions, then choose one.
  5. Copy.
  6. Design.

  One budget confirmation at the start states how many model calls and images the run may spend. The
  server gates stay. The page still never moves on its own: each step offers the next as a button.
- **Overlap safe work.** Pre-measure layouts and prepare variations while the person reads. Free work
  (variations, validation) may start without asking; paid work never starts without an explicit
  choice.
- **Cut duplication.** Remove duplicated screens and text (audit item 8). On every stage the main
  action must be the most visible thing.

### Phase 6 - Performance, resilience, accessibility, browsers

- **Budgets**, measured with mocked providers:

  | Measure | Budget |
  |---|---|
  | Studio interactive on a cold load (desktop broadband, cache off; report the throttling) | at most 2.5 s |
  | Stage switch | at most 150 ms |
  | Longest task on any interaction | at most 200 ms |
  | Heap over a 200-action session | steady |

- **Code structure.**
  - Split `docs/studio.js` into modules the page loads. No build step is required; keep the vendored
    React and htm.
  - Add `React.memo` where measurement shows re-render cost.
  - Move measurement-heavy work (variations, styles, validation of off-screen candidates) to a Web
    Worker with OffscreenCanvas where the browser supports it. Elsewhere, keep the current chunked
    main-thread path.
- **Resilience.**
  - An error boundary per panel, with a "this panel failed - reload it" state that keeps the rest of
    the Studio working.
  - An offline banner.
  - Retries with backoff for idempotent reads.
  - Every failed request explained, using the existing `explain()`.
- **Accessibility.**
  - Add `@axe-core/playwright` as a devDependency (update the lockfile). Fail on any serious or
    critical violation in every stage and state.
  - A keyboard-only journey from brief to delivery.
  - Screen-reader names for every control and every canvas layer.
  - Live regions for progress.
  - Contrast at AA in both themes.
- **Browsers.** Run the journey, editor and waiting suites in Chromium, WebKit and Firefox
  (Playwright projects), plus a touch tablet profile (1024x1366) and a phone profile (390x844). Fix
  what differs.

### Phase 7 - Proof and release

- Produce the evidence package in section 5.
- Update `CLAUDE.md` with an S23 section in the house style, and `CREATIVE-STUDIO.md` s.46.
- Bump the build to `studio-p39` and the page to `?v=r17`.
- Push the branch and ask the owner for "go live".

## 5. Definition of done: proof of everything

Nothing counts as done without its proof. Deliver all of the following, and list anything missing
under "not done" or "not proven".

1. **Tests.**
   - `npm test` summaries before and after (checks, backend and browser counts).
   - The new suites, by name, with their case counts.
   - The cross-browser matrix.
   - For every fixed defect, the failing run before and the passing run after, with commit ids.
2. **Zero errors.** Every browser suite runs under the console guard and reports zero unexpected
   console errors, page errors and unhandled rejections.
3. **Screens.**
   - Matched before/after screenshots of every stage and state at 1440x900, 1920x1080, 1024x768,
     390x844 and the tablet profile, with contact sheets (`tests/studio-s20-sheet.mjs`).
   - These include every waiting state: partial cards mid-stream, a render in progress, a stall, a
     recovery.
4. **Videos.** Playwright recordings with mocked providers of:
   - the full guided journey;
   - the rapid-response path;
   - an editing session: drag from the elements panel, a multi-selection transform, a crop inside a
     frame, the context menu, the history panel;
   - failure and recovery: provider down, dropped connection, cancel.
5. **Performance.** Each budget with its measured number before and after, plus the machine and the
   throttling used.
6. **Accessibility.** axe results per stage before and after, and the keyboard-only journey passing.
7. **A live smoke test for the owner.**
   - `tools/studio-smoke.py`, building on `tools/studio-demo.py`. It spends nothing without
     `--approve-calls N` and `--approve-renders N`.
   - It runs one rapid-response project on the deployed worker and writes a report: time to first
     feedback, partial results seen, the final validation, the export.
   - Give the exact commands to run on the Mac.

   Until the owner runs it and shares the output, live behaviour stays "not proven".
8. **An evidence page.**
   - Publish all of the above as a private Artifact page: screenshots, videos (compressed GIF or MP4
     within the size limits) and tables.
   - Commit its markdown summary to `CREATIVE-STUDIO.md` s.46.

## 6. How to work and report

- **Plan first.** Write a short checklist of slices, then work through it. Stop for permission only
  for something that spends money, deploys, merges to `main`, deletes data, or changes a decision
  recorded in `CLAUDE.md`. Where the spec is open, make a sensible decision and record it.
- **Commit** after each green slice with a clear message. Never leave the branch red.
- **If this prompt is wrong about the code,** trust the code, say so, and adapt.
- **Final message:**
  - what changed, by phase;
  - the evidence, with links;
  - what is not done or not proven, and why;
  - the owner's next steps: the deploy command, the smoke-test command, and "go live".
