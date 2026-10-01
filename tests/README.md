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

```
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

Playwright: the harnesses import it through `pw.mjs`, which uses the sandbox's
global install by default; set `PLAYWRIGHT_MJS` to your own
(`PLAYWRIGHT_MJS=./node_modules/playwright/index.mjs`). Each browser harness
starts its own static server on a fixed port in the 8766-8776 range and kills
it at the end.

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
