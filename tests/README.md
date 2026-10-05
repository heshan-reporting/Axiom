# Tests

The harnesses that prove the worker and the page, committed here so a regression
suite exists outside any one session. Nothing here touches the live worker: the
worker module is imported from `../axiomworkerv4.js` and run against a real
SQLite database behind the D1 API (`d1lite.mjs`), stub KV, R2, Workers AI and
Vectorize, and stub providers (Claude, Gemini, Slack, Reddit) that answer
canned fixtures. Browser harnesses serve `../docs` with Python's `http.server`
and drive it with Playwright, with every worker route stubbed.

## Running

Node 22 or later (the SQLite shim uses `node:sqlite`), Python 3, Chromium
through Playwright for the browser harnesses.

One command runs everything and names what failed (CI runs the same on every
push: `.github/workflows/ci.yml`):

```
npm ci                              # Playwright at the version package-lock.json pins
npx playwright install chromium     # once per machine (the cloud sandbox has it already)
npm run check                       # worker syntax, worker pure ASCII, RULES blocks identical, page scripts parse, nothing private in docs/
npm run test:backend                # every worker and tool harness without a browser, plus the Python tool tests
npm run test:browser                # the Chromium harnesses
npm test                            # all three: node tests/run.mjs all
```

Every provider is MOCKED (Claude, Gemini, Workers AI, Vectorize, Slack, Reddit,
the Supermetrics and Meta APIs): a pass proves the worker, the page and the
tools agree with each other, not what a live model answers or what production
data looks like. Real-model quality evaluations are separate, bounded and run
only with explicit approval (`tools/studio-showcase.py --approve-budget`,
`tools/studio-demo.py --approve-calls`).

Each harness on its own:

```
node --experimental-sqlite tests/auth-policy-worker.mjs   # R1 access: the route policy, roster validation, fail closed, read keys refused on writes and probes, no provider reached on a refusal, private URLs refused
node --experimental-sqlite tests/integrity-worker.mjs     # R2 persisted JSON: always valid when shrunk, oversize refused with the field named, corrupt job input fails visibly, GET /integrity read-only
node --experimental-sqlite tests/concurrency-worker.mjs   # R3 overlapping writes: brief edits against stages, project updates, locks, version appends, approvals of a moved version
node --experimental-sqlite tests/jobs-lifecycle-worker.mjs # R4 jobs: one claim per job, fenced attempts, terminal cancel, late reports ignored, lease checkpoints
node --experimental-sqlite tests/versions-worker.mjs      # R5 versions: the current version past 60 and with equal timestamps, paged history, restore
node --experimental-sqlite tests/ingest-worker.mjs        # R6 knowledge: whole-document indexing, partial with coverage, resume without duplicates, hash dedupe, the coverage report
node --experimental-sqlite tests/usage-worker.mjs         # R6 AI accounting: no lost increments, the cap under racing calls, retries and failures counted as such
node --experimental-sqlite tests/ai-boundaries-worker.mjs # R7 AI boundaries: an injected source and a subverted answer - mark policy, figure checks, namespace walls, malformed answers, "ship" is not approval
node --experimental-sqlite tests/diagnostics-worker.mjs   # R7 request ids on every answer, a safe 500 with the id, secrets struck from log lines
node --experimental-sqlite tests/studio-s1-worker.mjs      # S1 worker: placement inference reads negations, reference lines carry the words and addresses, the re-judging carries visibility and occlusion
node --experimental-sqlite tests/studio-quality-browser.mjs # S1 renderer (Chromium): zero-opacity words fail, transparent plates are no ground (composited contrast), later shapes and images that cover words fail, a rule-held mark is never moved by the repair or the variations, failed loads are unresolved
node --experimental-sqlite tests/studio-editor-browser.mjs  # S1/S3/S4/S5 page (Chromium): a failed validation filing is retried by Measure again and never shown as passed; canvas shortcuts leave the editor's fields alone; handles sit on the measured ink; framing by dragging (one drag one undo step, wheel zoom, centre and reset); locks hold in reorder and group, a mark keeps its proportions, a rule-held mark does not drag, unsaved layout edits are named and Cancel asks; Fix layout reports complete / partial / blocked with before and after counts, an undo, and is bounded
node --experimental-sqlite tests/studio-s2-worker.mjs      # S2 worker: the two creation modes - finished mode paints the whole piece with the campaign mark file attached as an image input (HOOF wordmark, never the MCA logo), files one bitmap with no layers, refuses layer edits (finished_bitmap), reads words and marks back before design approval, regenerates whole, derives an editable asset, exports the bitmap; the hybrid artwork mode labelled; mark missing fails before spend
node --experimental-sqlite tests/studio-scene-browser.mjs  # S3 renderer (Chromium): local (patchy) contrast against the brightest and darkest tenth of the ground, marks judged by their visible pixels (padding is not a collision, and is reported), a rotated mark's turned extents, one safe-area table, pixel analysis that cannot run is an unresolved state
node --experimental-sqlite tests/studio-s3-worker.mjs      # S3 worker: stSafeInset reads the renderer's safeAreaOf; the re-judging carries contrastMin, visible mark bounds (refused outside the box) and unresolved analyses (pixels_unmeasured never passes)
node --experimental-sqlite tests/studio-framing-browser.mjs # S4 renderer (Chromium): the documented image-to-canvas transform (coverTransform / imageToCanvas / canvasToImage / panFocus), the same focus in every aspect ratio, no empty edge, subjects as a saliency estimate with a bounded confidence, subject_covered as a warning, a framing suggestion that never crops the subject away
node --experimental-sqlite tests/studio-s5-worker.mjs      # S5 worker: a layout version that moves, resizes, retypes or removes a layer locked on the layout is 409 locked (element named); a mark held by a mandatory campaign rule is 409 mark_held; unlock:true overrides and the note records it
node --experimental-sqlite tests/studio-s6-worker.mjs      # S6 worker: the reference analysis stores the mark as data; placement as per-reference evidence with basis, confidence, agreement and exceptions (stMarkPlacement keeps its shape); GET /brand/inventory (usable / missing / unanalysed / conflicting / stored but never retrieved, recommendations with actions, examples wanted); Teach this brand (inspect writes nothing; a preview writes nothing; confirm with a reason writes the campaign markRule as a kit revision plus a rule item, a fact, a banned term or a learned rule); the taught rule rides on the produced mark layer and /studio/version refuses to move it; another client cannot teach
node --experimental-sqlite tests/studio-s7-worker.mjs      # S7 worker: one context compiler for strategy, directions, production, sequence, revise, concepts and suggestions; the manifest of what informed each (facts by id, banned terms, corrections by id, references attached/read, artwork memory, placement, marks, sections, models, and what was held back with the reason) on versions and events; the same CAMPAIGN IDENTITY line in every compiled instruction; GET /studio/used answers it through hand edits; namespaces stay walls
node --experimental-sqlite tests/studio-s8-worker.mjs      # S8 worker: directions measured on argument and medium - look-alikes and one-medium sets go back once (REPLAN) for replacements that differ in both, declined with replan:false, a stubborn look-alike marked; GET /studio/actions states the six actions (changes, preserves, cost, available and why) and follows the state (locked layout, render in flight, copy only, finished bitmap with regenerate / derive)
node --experimental-sqlite tests/studio-actions-browser.mjs # S8 page (Chromium): the Art direction panel's table of what each action changes, keeps and costs, buttons disabled with the reason when the worker says not now, reopened after an unlock
node --experimental-sqlite tests/studio-s9-browser.mjs      # S9 page (Chromium): the context bar names mode, campaign and content type; a Quality issue outlines its layers on the tile and the outline clears on a new version; the Art Director panel says what it saw, the words it read against the approved copy, what it did not score, that a review is one read and never approval; an accessibility audit (named controls and images, heading order, live regions, Alt+1..6, Tab) across the library, brief, Refine tabs, Brand, Review, Export and with a read key
node --experimental-sqlite tests/studio-s10-browser.mjs     # S10 end to end (Chromium, providers MOCKED): one HOOF project through the taught placement rule, production with the rule on the mark layer and the context manifest, the six actions, the inventory, the highlighting, the editor's held mark, Review, Export and Brand; the composed tile read back from its pixels per text box with tesseract.js when OCR_DIR holds it (else an ink check, named as such); screenshots to tests/shots/s10-*.png and the figures to tests/shots/s10-report.json
node --experimental-sqlite tests/studio-brand-browser.mjs  # S6 page (Chromium): the inventory strip and tables, the placement evidence table, Inspect -> use -> Preview (nothing written) -> Confirm with a reason -> the approved rule shown and in the kit history; a read-only key sees no Teach controls
node --experimental-sqlite tests/studio-modes-browser.mjs  # S2 page (Chromium): the mode chosen at intake, the bitmap labelled with no layout tools, painted words read-only and caption editable, Review waits for the reading back, Regenerate and Switch to Editable
node --experimental-sqlite tests/studio-worker.mjs        # Creative Studio Phase 1 (projects, versions, approvals, jobs, legacy)
node --experimental-sqlite tests/studio-p2-worker.mjs     # Creative Studio Phase 2 (ledger, directions, copy, checks, layouts, export, budget)
node --experimental-sqlite tests/studio-p3-worker.mjs     # Creative Studio Phases 3-4 (direction by instruction, Remember, outcomes, KV session import)
node --experimental-sqlite tests/studio-p6-worker.mjs     # art direction as design: reference analysis, design specs, combined revisions, suggestions
node --experimental-sqlite tests/studio-variations-demo.mjs  # draws five compositions of one message to tests/shot-variations.png (the creative outcome, to look at)
node --experimental-sqlite tests/studio-p7-worker.mjs     # design beyond the preset: wordmarks and policy, expressive plans, carousels, references to the image model, artwork mode, edits, inspection, new designs
node --experimental-sqlite tests/studio-plan-demo.mjs     # draws the plan engine's mechanics with synthetic imagery to tests/shot-plans.png (not finished quality)
node --experimental-sqlite tests/studio-p8-worker.mjs     # production-quality workflow: plan-engine production, brief check and sourced suggestions, mark policy enforced, reference packs, retain, replanning, Gemini gaps, composed inspection
node --experimental-sqlite tests/studio-p9-worker.mjs     # production readiness: measurements re-judged by the worker, readiness states, approval and export gates, inconsistent inspections, painted words, figure checks, wordmark variants
node --experimental-sqlite tests/studio-p10-worker.mjs    # the Brand Workspace: authority, scope, readiness, reviewed memory, wordmark variants, kit history, isolation, what the Studio used
node --experimental-sqlite tests/studio-p11-worker.mjs    # client review: private scoped links (hash only), allow-list, pins, stale versions, approval after the agency, resolution by version, delivery, revocation, lockout
node --experimental-sqlite tests/studio-p12-worker.mjs    # strategy drafted and confirmed, the exploration budget and diversity, the campaign sequence with no render
node --experimental-sqlite tests/studio-p14-worker.mjs    # recipes: estimate, confirm before renders, chained steps that wait and stop on an upstream failure; impact with free remedies; actual usage
node --experimental-sqlite tests/studio-p15-worker.mjs    # outcome metrics against the previous window and the desks, n beside every median, the isolation audit (rules, references, marks)
node --experimental-sqlite tests/studio-demo-test.mjs      # tools/studio-demo.py: estimate only without approval; the six steps for HOOF, MCA national and the synthetic client with no image; separation, isolation, the kit guard
node --experimental-sqlite tests/studio-p17-worker.mjs    # area edits by description (no pixel mask): prompt, edit record and limits, nothing spent on a bad edit, preservation judged against the source version
node --experimental-sqlite tests/studio-p18-worker.mjs    # no imagery: the planner is told, image regions are dropped, the flag carries into refinement, nothing renders
node --experimental-sqlite tests/studio-p19-worker.mjs    # freeform everywhere: focused layer edits by id (locks, copy roles and a mandatory mark refused), plan-based redesign, faithful adaptation, planned sequences, labelled house fallback, art memory scoped by campaign
node --experimental-sqlite tests/studio-p20-worker.mjs    # Explore layouts: the same photograph and words, new regions and invented words set aside, look-alikes replanned against the current layout, layout-only apply; image framing
node --experimental-sqlite tests/studio-p21-worker.mjs    # reference recipes, influence per concept, the compiled instruction filed per job (no keys), the capability registry
node --experimental-sqlite tests/studio-p22-worker.mjs    # inspection reasons, unscored is null, bound to its version, stale after an edit, bounded rounds
node --experimental-sqlite tests/studio-brand-gaps-test.mjs # tools/studio-brand-gaps.py: the request for approved material, and reference analysis only within an approved call budget
node --experimental-sqlite tests/studio-review-browser.mjs # docs/review.html and the Studio Client review view in Chromium through the worker module
node --experimental-sqlite tests/studio-layout-browser.mjs  # the renderer's measurement, validation and repair in real Chromium (HOOF reconstruction, worker layouts in four formats, fonts, marks); writes tests/shot-layout-repair.png
node --experimental-sqlite tests/studio-journey-browser.mjs # the workspace end to end in Chromium (providers MOCKED): create -> brief -> direction -> produce -> refine -> review -> export with the zip unpacked and every PNG sized; reload and resume; client switch; no imagery; adaptation into a story; provider outage and retry; a second edit during a slow save; the keyboard path (SHOT=1 writes tests/shots/journey-*.png)
node --experimental-sqlite tests/studio-p23-worker.mjs    # adaptation into a format with a wider interface margin lands inside its safe area; same-margin adaptations keep their geometry
node --experimental-sqlite tests/studio-shots.mjs before|after # screenshots of one seeded project at 1440, 1920 and 390 px into tests/shots/ (ignored by git)
node --experimental-sqlite tests/studio-compose-test.mjs  # tools/studio-compose.mjs against the worker served locally: the composed tile drawn at native size and saved as the export
node --experimental-sqlite tests/studio-showcase-test.mjs # tools/studio-showcase.py end to end with stub models: nothing without --approve-budget, the render cap, compose before inspect
node --experimental-sqlite tests/content-worker.mjs       # Content Desk routes and the creative shelf
node --experimental-sqlite tests/artwork-worker.mjs       # artwork memory
node --experimental-sqlite tests/overview-worker.mjs      # the front page and the daily brief
node --experimental-sqlite tests/narratives-worker.mjs
node --experimental-sqlite tests/sentiment-worker.mjs
node --experimental-sqlite tests/social-worker.mjs
node --experimental-sqlite tests/sources-worker.mjs
node --experimental-sqlite tests/studio-browser.mjs       # the Studio journey in a browser through the in-process worker; SHOT=1 writes screenshots beside it
node tests/overview-browser.mjs                           # also narratives-, sentiment-, sources-, signals-, scope-, content-browser
python3 tests/engine-ingest-test.py
python3 tests/reach-render-test.py
```

Playwright: the harnesses import it through `pw.mjs`, which looks in order at
`PLAYWRIGHT_MJS` (a path to `playwright/index.mjs`), the project's own
`node_modules` (`npm ci`), then the global install (`npm root -g`); no path is
tied to one machine. `studio-fixture.mjs` seeds the journey harness and
`studio-answers.mjs` holds the mocked model answers it and the boundary
evaluations share. `worker-env.mjs` is the backend fixture for the reliability
harnesses: the worker in-process over SQLite with a recording `fetch` (every
outbound call is listed, so a test can prove a refused request reached no
provider) and `slowReads(ms)`, which makes overlapping requests interleave
between their read and their write. `PW_CPU_THROTTLE=4` (Chrome's CPU throttling on every page) with `LANG=C.UTF-8` runs the browser harnesses the way a
slower CI runner does: a case that reads the page before it has rendered fails here first. Each browser harness starts its own static
server on a fixed port in the 8766-8776 range and kills it at the end.

## What is covered

- `studio-worker.mjs`: every Phase 1 acceptance line of the Creative Studio
  proposal - gating and read-only roles on the creative endpoints, fail-closed
  auth on a broken key roster, one project per idempotency key, namespace
  walls, immutable versions and stale-revision conflicts, cross-project
  refusal, approvals by content signature, locks, idempotent jobs, leases and
  abandoned-runner recovery, bounded retries that tell transient from invalid,
  cancel, the stale-result branch, legacy adapters with untouched originals,
  idempotent import, inventory, the models probe, archive.
- `studio-p2-worker.mjs`: the Phase 2 production journey - the client context
  (kit, facts, banned terms, learned rules, no other client's), the claim
  ledger with passages and unverified rows, directions for an open brief,
  copy adapted per channel with the deterministic checks (matches / differs /
  unsupported / banned / overflow), compositions with the exact kit logo,
  render jobs queued by idempotent key, a headline edit without an image
  call, the namespace wall in the prompt, the daily budget and the account
  spend limit, the adaptive-thinking fallback, export of approved versions
  only with nothing sent anywhere, the rule-only ledger without a Claude key.
- `studio-p3-worker.mjs`: direction by instruction - text and layout changes
  as versions with locks honoured, alternatives offered with checks, a render
  proposed and run only on confirmation, adaptation reusing the image, the
  ambiguous-pronoun question, the Remember offer saved as a campaign
  preference (read by that campaign only) or a client rule or declined, WIN
  and LOSS exemplars on approve and reject, KV session import, and art
  direction (the artwork shown to the model, distinct directions as layout
  variants with basis and cost, layout-only apply with no render, render only
  when asked, locked layers kept).
- `studio-p6-worker.mjs`: art direction as design. References are read by a
  vision pass at upload and stored (a failure is stored as the limitation),
  and reach the concepts, revise, copy and suggestion prompts as images and
  analyses with their purpose semantics; the client's artwork memory comes
  with them and never another client's. A direction is a whole design spec
  (image brief, composition style and zone, type, panel, logo corner, CTA)
  laid out by `stLayoutFromSpec` for any format: gradient from the top, a
  split with the words left, a typography-led tile, a compact panel on the
  right; four distinct compositions, three on the current photograph; the
  layout of one card with the photograph of another; a combined "split and
  a wider photograph" direction applied as a layout version with the
  photograph proposed; photograph prompts that follow the composition's
  quiet zone; cached suggestions; locks and hidden layers carried through.
- `studio-variations-demo.mjs`: not a test but the outcome to look at - one
  message, one photograph, five compositions drawn by the one renderer onto
  `tests/shot-variations.png`.
- `studio-p7-worker.mjs`: design beyond the preset. A campaign wordmark is
  stored and served and its logo policy decides the mark on that campaign's
  tiles; concepts arrive as expressive plans (medium, approach, regions with
  their own image instructions and references, free text groups with
  emphasis, devices, carousel frames) and are laid out without silently
  reducing what cannot be drawn; distinctness is measured on the drawn
  result; a carousel applies as one asset per frame; the image model receives
  the reference images with their roles; the full-artwork approach marks its
  words as part of the bitmap; an edit replays the model's parts and thought
  signatures; 4K is honoured and a fallback is visible; every render is
  inspected and one bounded correction can be applied; Create a new design
  starts from the brief with the chosen references and inherits no panel.
- `studio-p8-worker.mjs`: the production-quality workflow (build studio-p8).
  First production through the plan engine with a house fallback that says so
  and the chosen resolution forwarded; the brief check before spending (no
  silent first campaign, nothing-to-write-from refused, acknowledgement
  recorded); sourced brief suggestions (approved, preference, previous,
  reference, ai on request); the campaign mark policy enforced (a plan cannot
  override it, a missing mandatory mark makes the composition incomplete and
  blocks design approval, never substituted) and placement learned from
  approved references; campaign isolation and the identity audit; the reference
  pack in three modes with another campaign's references excluded and a large
  original shown through a prepared copy; retain controls in planning and
  application; one bounded replanning round; size forwarding; region renders
  merging instead of branching; cutout transparency; the final, non-thought
  image; no edit history replayed to another model; the inspection of the
  composed export with the whole text inventory; stale corrections refused;
  ship never approves; adaptation re-planned from the master's plan.
- `studio-p9-worker.mjs`: production readiness (build studio-p9). A
  measurement report is refused when it describes other words, another output
  size, moved geometry, an impossible wrap, another mark file or a missing
  layer; a truthful report of the HOOF reconstruction fails on the shared rules
  whatever the client claimed; readiness keeps not validated / stale / failed /
  passed apart from the art director's assessment and from approval; design
  approval and export need a passing validation of exactly this composition; a
  caption edit carries the evidence and a displayed-copy edit or a new mark file
  makes it stale; ship over a blocker or with a material finding is
  inconsistent and needs a person's acknowledgement, which never overrides a
  technical blocker; painted words must be read back; figures in free text,
  another campaign's or a pending fact, brief-only numbers, units and periods;
  suggested figures flagged; wordmark variants and the logo under immutable
  versioned keys; a region render whose region is gone branches; a render with
  no image writes nothing; a layout repair spends nothing.
- `studio-p10-worker.mjs`: the Brand Workspace (build studio-p10). The kit's
  revision history and a logo version that survives a palette edit; readiness
  blocked by a missing required mark and carried on the brief check; the
  wordmark variant library (tones, default, per-variant history, the single
  slot named as a conflict beside variants, the identity audit seeing them);
  authorities and scope on every item with other campaigns left out; conflicts
  (a banned term in an approved fact, facts that disagree, a logo preference on
  a wordmark campaign) and dated or pending facts; items with revisions, an
  inference kept only as a proposal, keep and dismiss; approval reasons as
  proposals that write no rule; namespace walls; what the Studio used through a
  later hand edit.
- `studio-layout-browser.mjs`: `docs/studio-render.js` in headless Chromium.
- `studio-fixture.mjs`: the shared fixture for the workspace journeys - the worker module in-process, stub Claude and Gemini that can be switched to `down`, `slow` or `missing`, a real gradient PNG, a held-request hook to make a save "still in flight", and a zip reader for the export.
  The layout rules are byte-identical in the renderer and the worker; the app
  fonts (served from `FONT_DIR`, OFL) are waited for and the face used is
  reported, a late or missing face is a disclosed fallback; the HOOF
  reconstruction is caught (headline overflow, headline/support collision,
  wordmark at 3.05:1) and repaired with no request, the same words, the same
  layers and imagery and the white variant; preview, export PNG and the
  inspected file are the same pixels; the worker's own house layouts in 1:1,
  4:5, 9:16 and 16:9 with short and long copy; explicit breaks, long addresses,
  multi-line CTAs, free text, scoped overlap exceptions, rotation, highlight,
  hidden layers, duplicate ids, impossible geometry, off-canvas, the story safe
  area, unreadable type; missing, late and failed marks; baked artwork not drawn
  twice; manual moves, locked layers, carousel frames. Everything drawn is
  synthetic and the sheet says so.
- `studio-compose-test.mjs` and `studio-showcase-test.mjs`: the two Mac tools
  against the worker module served over HTTP in-process (stub models, real
  headless Chromium for the renderer).
- `studio-plan-demo.mjs`: the plan engine's mechanics drawn with synthetic
  imagery to `tests/shot-plans.png`. Not finished creative quality: the
  finished renders come from `tools/studio-showcase.py` on the live worker.
- `studio-browser.mjs`: the same journey in a real browser. The page's calls
  to the worker are routed into the worker module running in the harness
  process, so intake, extraction, production, the renderer's preview, hand
  edits, approvals, export and the read-only role are exercised end to end.
- The rest: the modules named in each file's header.

Confidential material never belongs here: fixtures are synthetic. A live,
cost-bounded evaluation of model output quality is a separate, authorised run.
