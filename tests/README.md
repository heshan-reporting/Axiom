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
