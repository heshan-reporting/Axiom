# Claude Code prompt: the creative engines, and a Canva-class Create workspace (after P49: worker p49, page `?v=r36`)

Paste everything below the line into Claude Code, opened at the root of the `Axiom` repository.

---

You are working in the AXIOM repository. Read `CLAUDE.md` first: it is the system map and its rules apply. Then read
`CREATIVE-STUDIO.md` s.53-s.60 and `prompts/studio-production-ready.md`. The Creative Studio is the React island in
`docs/studio.js` with:
- `studio-guided.js`, the guided steps;
- `studio-editor.js`, `studio-canvas.js` and `studio-style.js`, the canvas;
- `studio-render.js`, the one renderer: preview, measurement and export;
- `studio-progress.js` and `studio-merge.js`.

It runs on the `/studio/*`, `/brand/*`, `/engine/*` and `/mind/*` routes of the Cloudflare Worker `axiomworkerv4.js`.

## The goal

The owner asked for this, in their words: "Fix rest of the issues and improve the creative engine including the copy writing
engine, client knowledge engine, client relevance engine, client memory, then the design engine with visible top notch
production ready visual ui, with a UI building to be better and at the same time fix all the issues in the design area where
you can design it to be same as Canva by reverse engineering Canva in the create section."

Read that as four outcomes:
1. The open issues closed.
2. Each engine measurably better, with evidence.
3. A Create step that works and feels like a first-class design editor, held to the standard of Canva's editor.
4. A visual UI that a creative team would call production quality.

## What "same as Canva" means here, and what it does not

- **Learn from public behaviour only.** Study Canva's editor as a user sees it: its public pages, help centre, published
  keyboard shortcuts and the visible behaviour of its editor. Match the interaction patterns that are now the convention
  for design editors: an object panel to drag from, a floating contextual toolbar, a page strip, snapping and spacing hints,
  one-click resize, layer order, text effects, and so on.
- **Copy nothing of Canva's own.** Do not copy Canva's code, assets, templates, icons, fonts, illustrations, names, wording,
  logo, colours or overall look. Do not decompile or scrape its application, and do not call its private APIs. Every
  template, icon and default the Studio ships is original, or comes from an open-licensed source recorded in
  `ATTRIBUTION.md` (as the vendored DM Sans and Manrope faces already are).
- **Keep the Studio's own design language.** That is the tokens in `docs/studio-skin.css` and `docs/studio-shell.css`, with
  the client's accent as `--st-client-accent`.
- **Keep the Studio's guarantees.** Words, marks and shapes stay live layers drawn by `studio-render.js`. What the editor
  shows is what is measured and exported. Locks, rule-held marks, approvals, drafts, the three-way merge and the validation
  contract are unchanged. A new tool is a new layer property or layer type that the renderer draws, the RULES block judges
  and the worker's judge accepts. It is never an overlay that only the editor sees.

## Rules for this work

- **Test first.** Every defect gets a test that fails on the current commit and passes after the fix. Every new capability
  gets acceptance tests:
  - worker cases in `tests/studio-p50-worker.mjs` (and later numbers);
  - browser cases in `tests/studio-r4-browser.mjs` (and later numbers), on `tests/studio-fixture.mjs`.
- **Providers mocked only.** Make no paid Claude or Gemini call, contact no live worker, and run nothing in `tools/` that
  spends (`studio-smoke.py`, `studio-demo.py`, `studio-showcase.py`, `studio-golden.py` against live). Where an engine
  change needs a real model to judge it, write the evaluation and leave the live run to the owner, with its estimated cost.
- **Keep the contracts.** Keep the worker pure ASCII and the RULES block byte-identical between `docs/studio-render.js`
  and the worker. Keep MCA and HOOF apart: HOOF carries its own HANDS OFF OUR FUEL wordmark and never the MCA logo, and
  campaign walls hold for facts, rules, references and artwork. A client's memory never reaches another client.
- **Approval is a person's decision.** A measurement, a model verdict or a score is never an approval.
- **Bump the release markers on every release.** Bump the page's `?v=` and run `node tests/asset-versions.mjs --write`.
  Bump `AXIOM_BUILD` when the worker changes. Set `PAGE_NEEDS_BUILD` when the page needs the new worker.
- **Gate every slice.** `node tests/run.mjs all` must pass before each commit. Add a `CREATIVE-STUDIO.md` section and a
  `CLAUDE.md` paragraph per release. Commit to the session's `claude/...` branch and push. The owner merges and deploys the
  worker with `tools/deploy-worker.sh`.

## Phase 0: baseline (no edits)

- Run `node tests/run.mjs all`, `tests/studio-s27-sweep.mjs before` and `tests/studio-s19-perf-browser.mjs`, and keep the
  figures.
- Take before screenshots of every step at 1440 x 900, 1920 x 1080 and 1366 x 768 with
  `tests/studio-r2-shots.mjs before 1440`, adding the other two desktop sizes to the script. Phone and tablet layouts are
  out of scope for this work (the owner's decision): do not spend on them, and do not make them worse.
- Write `CREATIVE-STUDIO.md` s.61.0: the baseline, and a capability matrix for the Create step against the editor
  conventions in Phase 5. Mark each capability as built, partial or missing, with the file and function for what exists.

## Phase 1: close what is open

1. **The deploy check gives up on a rollout.** `tools/deploy-worker.sh` gives up on the first non-200/401 from
   `/engine/status`, which a deploy can meet for a few seconds while Cloudflare switches versions. On 4 November that made
   the owner deploy twice. Retry the check, say 6 times 5 s apart, before failing, and say that it is retrying. Add a test
   with a stub server that answers 500 twice, then 401.
2. **The six readiness checks in `prompts/studio-production-ready.md`.** These are the evaluation plan, the D1 query counts
   per route, error codes the page does not know, editors without a revision, the accessibility gate and the cost
   statement on every paid button. Report on each, and fix what is confirmed.
3. **Six earlier findings to re-verify.** Each prior audit in `CREATIVE-STUDIO.md` (s.50-s.60) has an "open" or "not done"
   line. Re-verify each one against the current code: close it with a test, or state why it stays open.

## Phase 2: the copywriting engine

Today:
- `stCopyStage` writes and plans each channel in one creative-model call.
- `stReviseStage` handles direction.
- The copy partner's quick asks are revise calls.
- `stKitStage` writes the message kit.
- `stChecks` is the deterministic gate: figures against the ledger and facts, banned terms aware of negation, limits,
  hashtags and the campaign's address.
- The Content Desk (`contentCompose`) is a parallel path with its own prompt.

Improve it so that a writer would trust the first draft:

- **One writing core.** The Studio's copy stage, the revise stage, the message kit and the Content Desk compose from one
  prompt builder. That builder takes the brief, the chosen objective, message and strategy, the direction, the client
  context from `stCompileContext`, the platform specs (`CONTENT_PLATFORMS`, the kit's own platform notes) and the
  exemplars. Each surface keeps its own output schema. Test that every surface's prompt carries the same voice, rules,
  facts and banned terms for the same client and campaign.
- **Channel craft, measured.** Add deterministic measures to the checks and show them beside the words:
  - headline length against `ST_HEADLINE_FIT` per format;
  - reading grade (a plain formula: no model);
  - the first characters a feed shows before "more";
  - hashtag policy;
  - the CTA present and matching the brief's action;
  - one message per piece (no second claim);
  - the campaign sign-off and address.

  These are measurements, labelled as such.
- **Several options, then a choice.** For the headline and the first line, the engine offers 3 options that differ in
  approach (fact-led, question, contrast, voice-of-person). They are measured on the checks above and on similarity to one
  another (no near-duplicates). They are shown side by side, and choosing one is a text version. Count the calls in the
  cost statement.
- **Voice adherence.** Score each piece against the client's voice. Use deterministic signals: banned and preferred terms
  from the kit, sentence length, person and tense, and exclamation and jargon lists from the kit's rules. Show which rule
  each signal comes from. This is not a model opinion.
- **Rewrite in place.** On the canvas, a selected text layer gets Shorter, Plainer, More urgent, Fix to the facts and
  Translate to the campaign's tone. Each is one revise call scoped to that layer and field, and it lands as a version with
  the checks recomputed. This is the Studio's own "magic write", built on its own engine.
- **Golden set.** Build `tests/fixtures/copy-golden/`: briefs for the synthetic client `synthdemo` only (no client
  material) with expected properties: facts used, banned terms absent, CTA, limits. Write a deterministic scorer
  (`tools/copy-eval.mjs`) that runs against the mocked engine in CI and, with the owner's approval and `--approve-calls N`,
  against the live worker. The live run is not part of this task.

## Phase 3: the client knowledge engine

Today:
- The kit, with facts, banned terms, voice, campaigns and marks.
- Brand items, with authority and status.
- References, with their vision analysis, recipe and metadata.
- Learned corrections.
- Described artwork.
- `brInventory`, which reports what reaches the models and what does not.
- `stCompileContext`, which builds the manifest of what informed each call.

Improve it so that what the Studio knows is complete, current and visible:

- **One knowledge view per client and campaign.** Every fact, rule, preference, reference observation, mark and example,
  each with its authority, scope, status, source, last confirmation and use count (how many versions it informed, from
  `informed` manifests). Find and resolve duplicates across the kit, `brand_items` and corrections. A person merges them,
  never the engine alone.
- **Freshness.** Facts carry an optional `review_by` date. An expired or unreviewed fact is shown as such and is left out
  of production unless a person confirms it. The copy checks treat an expired fact as unsupported. Add a test.
- **Gaps that block work, stated before spending.** `brReadiness` already lists blocking gaps. Make the guided Brief step
  show them first, with the one action each needs (upload the mark, confirm the fact, analyse the reference).
- **Ingest that says what it learned.** Teach this brand, reference uploads and `engine-ingest.py` return a short receipt:
  what was added, what was proposed for review, and what was refused and why.

## Phase 4: the client relevance engine and client memory

Relevance today:
- `stAnalyseStage` reads the material against the client (`CLIENT_ISSUES`, the campaigns and the facts).
- It retrieves knowledge with `stIntelKnowledge` (Mind passages, narratives, alerts, decisions, earlier choices,
  sentiment, facts).
- It sorts kept from set-aside paragraphs and judges issues as high, potential or not.

Memory today:
- `engine_fixes`, the rules.
- `engine_outcomes`, WIN and LOSS, filed once and retracted on withdrawal.
- `studio_intel_log`, the choices.
- The creative shelf in the Mind.
- Test projects file nothing.

Improve them:

- **Relevance you can audit.** For each paragraph kept or set aside, and each issue judged, show the evidence: the
  `CLIENT_ISSUES` matcher that fired, the entity named, and the knowledge item cited. Add a deterministic pre-pass so that
  a paragraph with no matcher, entity or campaign term can only be kept with a stated reason from the model. Build a
  labelled set for `synthdemo` in `tests/fixtures/relevance/` and a scorer (precision and recall of kept paragraphs, issue
  accuracy) that runs on the mocked engine in CI.
- **Retrieval that ranks for the task.** `mindRetrieve` with the creative shelf and `stIntelKnowledge` should rank by:
  - the campaign first;
  - approved over background;
  - recent decisions over old ones;
  - rejected work as "avoid".

  Write tests that a busier campaign's material never outranks the current campaign's.
- **Memory that stays true.**
  - Rules gain a hit count, the last time each was applied, and contradictions (`stRuleConflicts`).
  - A rule never applied in 90 days is proposed for review, never deleted.
  - Outcomes are shown per client as a learning summary: what kind of work was approved or killed, and why, from the
    recorded reasons.
  - A person can see, for any version, every memory item that shaped it (extend "What informed this creative?").
  - Retraction stays exact: test that a withdrawn decision never reaches a prompt.
- **Isolation.** Re-run `stIsolationAudit` across clients and campaigns after every change. A cross-client or
  cross-campaign leak in any prompt, retrieval or check fails CI.

## Phase 5: the design engine and the Create workspace (a Canva-class editor)

The Create step already has a strong core:
- the one renderer;
- validation and repair;
- nine layout variations and ten style variations;
- resize to other formats;
- the Add item panel: layouts, typography, shapes, lines, frames, brand colours and marks, media, icons;
- drag from the panel and a desktop drop;
- snapping with spacing hints, rulers and guides;
- a contextual floating toolbar, a font picker, effects and image adjustments;
- crop and framing;
- layers with lock, hide and rename;
- copy and paste of a style, grouping;
- undo with a named history;
- the version strip, the page strip and the Creative Partner.

Use the Phase 0 matrix, and add or finish the editor conventions that are missing or partial. Each must be a renderer-drawn
layer property or type, validated and exported. The likely gaps:

- **Templates.**
  - A library of original, editable templates per format and medium: myth/fact, stat card, quote, announcement,
    carousel opener, event, petition, explainer.
  - They are built from the plan schema (`ST_PLAN_SCHEMA`), filled from the brief and the copy, coloured from the
    campaign's kit, and carry the campaign's mark by its policy.
  - Applying one is a layout version with no render.
  - Templates are searchable and filterable by format, and previewed with the piece's own words.
- **Pages.**
  - A piece's frames (a carousel) as pages: add, duplicate, delete (archive), reorder by drag, and a grid view of all
    pages.
  - The page strip and a carousel family stay one record.
  - Keep `context.sequence` and `order` true.
- **Text.**
  - Text effects presets (shadow, lift, hollow, outline, neon, background, splice), each a combination of the effects the
    renderer already draws.
  - Curved text along an arc (a new text property the renderer draws, measures and validates).
  - Bulleted and numbered lists.
  - Font pairing suggestions from the kit.
  - Auto-fit and auto-height boxes.
- **Elements.**
  - Tables (rows and columns as a layer type, measured).
  - Simple charts (bar, column, line, pie, from typed data, drawn by the renderer, and labelled with their figures so the
    copy checks read them).
  - Photo grids and frames that take an image by drop.
  - Stickers and illustrations from an open-licensed set recorded in `ATTRIBUTION.md`.
- **Images.**
  - Crop, flip, filters and adjustments, which exist; finish them.
  - Background removal, through the existing area-edit render path as a stated, confirmed image call, with the result as
    a cutout layer and preservation measured.
  - "Replace image" from uploads or a new render.
- **Arrange and position.**
  - A Position panel: align to page, distribute, order, rotate, size in px with the aspect lock, and transparency.
  - Tidy-up spacing for a selection.
  - Group, ungroup and lock in the right-click menu.
- **Resize.** One action for every preset format, which exists. Show a preview grid of each result, measured, before
  creating them.
- **Brand.**
  - The campaign's colours, fonts and marks in every picker, first.
  - A brand-control mode that warns when a colour or font is off the kit, without blocking the person.
- **Collaboration.**
  - Comments pinned on the canvas for the team: the client review already has pins; add an internal thread per asset with
    mentions as plain names.
  - Show who is editing the same asset, from drafts by person.
- **Keyboard and feel.**
  - The full shortcut sheet.
  - Every action reachable by keyboard.
  - 60 frames a second while dragging a 50-layer composition (`tests/studio-s19-perf-browser.mjs`).
  - No layout shift when a panel opens.

The design engine (model side):
- The concepts and directions stages already produce plans.
- Make templates and plans one vocabulary, so that a model's plan can be "template X with these changes" and a person's
  template choice can be refined by the model.
- Add a measured design-quality score from the renderer:
  - alignment to a grid;
  - consistent margins;
  - type scale ratio;
  - contrast;
  - hierarchy (headline area vs support);
  - whitespace balance;
  - mark placement against its rule.

  Show it as a measurement beside the Creative Partner's opinion, never instead of it.

## Phase 6: the visible UI, production quality

- **One design system.** Every Studio surface reads tokens from `studio-skin.css` and frame rules from `studio-shell.css`.
  Remove one-off colours, radii and spacing found by a stylesheet scan. Write `tests/studio-tokens-test.mjs` that fails on
  a hex colour or pixel radius outside the token files.
- **States.** Every panel has designed empty, loading (skeleton), error (explained, with Retry) and read-only states.
  Every paid action states its cost before running. Every long action shows the progress line.
- **Typography and spacing.** One type scale (display, title, body, label, mono) and a 4 px spacing grid. Audit with a
  screenshot sheet of every step at the three desktop sizes, before and after.
- **Motion.** Purposeful only: panels, the selection and job progress. Turn it all off under `prefers-reduced-motion`.
- **Accessibility.** `tests/studio-a11y-browser.mjs` passes with no serious or critical finding at the desktop widths, in both
  roles, with dialogs and panels open. Focus is always visible and contrast is AA on every token pair (test the pairs).
- **Desktop first.** Design and test for desktop: 1366 x 768 upwards, with 1440 x 900 as the reference. Phone and tablet
  layouts are out of scope for now (the owner's decision). Existing small-screen behaviour may stay as it is, but no change
  may make it worse, and the existing harnesses that cover it must still pass.

## Deliverables at the end of each phase

- The tests: new cases failing first, then passing.
- The gate's numbers.
- Before and after screenshots (`tests/shots/`, ignored by git).
- The `CREATIVE-STUDIO.md` section, with a ledger: id, severity, what, where, test, status.
- The `CLAUDE.md` paragraph.
- A commit pushed to the branch.

At the very end, report:
- what each engine now measures that it did not;
- the capability matrix for Create, before and after;
- the cost of the live evaluations the owner should approve next;
- what could not be verified in the sandbox, said plainly.
