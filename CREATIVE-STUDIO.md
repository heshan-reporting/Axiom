# Creative Studio: design record (Phases 0-4)

Status: Phases 0-2 are merged; Phases 3 (direction by instruction) and 4 (one island) are built on branch `claude/peaceful-gates-g1t4ss` and await the merge and the worker redeploy. Sections 1-8 are the Phase 0 record; sections 9 and 10 record what the build settled. The approved proposal (30 September 2026) governs scope: consolidate the Release Desk, the Content Desk and the existing Creative Studio into one feature; reuse the Ad Lab layer editor where it helps; retiring Ad Lab is a separate decision; everything else in AXIOM is out of scope. This document records the design decisions the proposal left to Phase 0 and what was found.

## 1. Prototype

`docs/studio.js` (React island, `#v-studio`, nav tab "Studio") runs the whole journey on synthetic data with simulated models and jobs, and says so on screen. It exists to correct the design before the backend is built. Harness: `studio-browser.mjs` in the session scratchpad (to be committed under `tests/` in Phase 1 with the other harnesses).

What it demonstrates, and where each acceptance line of the proposal is exercised:

| Proposal requirement | In the prototype |
|---|---|
| Project library with client filter, status, owner, activity | Library view; switching client clears the open project and shows only that client's work; legacy items listed read-only with Import |
| Three starting points, minimal intake, visible assumptions | Intake: start from a release / a brief or one line / existing creative; deliverable copy, visual or set; campaign choice; channels as editable suggestions; the brief view lists assumptions with Remove |
| Clear instruction skips ideation; open brief gets directions | Intake reads the text: an imperative line goes straight to production and the Directions stage is shown struck through; an open brief creates two directions first |
| Directions: message, insight, headline, opening, visual, rationale, claims, uncertainty; choose, combine, another | Directions view; Choose saves the decision and starts production |
| Assets with families, formats, versions, copy, layout | Left-rail asset tree by family; asset view with composition preview, editable fields, layout line, versions drawer |
| Editable composition versus generated artwork | Composition tag on the preview; imported legacy tiles are flattened, their on-image fields disabled, with Rebuild as composition offered |
| Text change without a render; regeneration announced first | "Keep the layout, sharpen the headline" creates a text version, same image, "no render spent"; "more restrained visual" answers with a proposed interpretation and a Do this button; the job appears under Jobs while it runs |
| Alternatives beside the field | "three alternative opening lines" returns three chips; choosing one is a text change |
| Explicit targets; ambiguous pronoun is questioned | Composer target: selected element / this asset / the family / the whole set; "make this shorter" aimed at the set is asked about, not applied |
| Locks survive revisions | Per-field lock; a direction at a locked field is refused until unlocked; replies list what stayed locked |
| Compare, restore, immutable versions | Compare shows the differing fields and images side by side; Restore creates a new version referencing the earlier one, later history kept |
| Component approvals with reasons; edits invalidate the changed component only | Approve copy / design records a reason ("acceptance, never performance"); a copy edit removes the copy approval and leaves design |
| Checks: matches / differs (value, unit) / not supported / overflow | Deterministic ledger matching on figures with units and on quotations; "$74 million" against a "$74 billion" source is *differs from source*; a 9:16 headline over the fit is flagged |
| Export against exact approved versions; hand-off is a separate explicit step | Export dialog includes only assets whose copy and design approvals name the current version; Send to ClickUp is its own confirmed dialog naming destination and assets |
| Save as preference, not automatic; proposed wording; campaign or client scope | A standing-sounding instruction or rejection reason produces a non-blocking offer; the wording is editable; Campaign preference / Lasting client rule / Don't save |
| Job status without invented percentages; retry, cancel | Jobs view: stage, asset, state, attempts, elapsed; cancel notes the in-flight call may still cost |
| Read-only role | A read key reviews, compares and exports; no composer, locks or approvals |

## 2. Ad Lab canvas audit

Read from `docs/index.html` (`alCanvasRender`, `alStageBind`, `alPropsRender`, `alExport`, `AL_FONTS`).

- **Document model.** Layers of three types (text, image, shape) positioned in percentages of the stage, rotation, opacity; text carries size as a percentage of stage width, weight, colour, plate, alignment and one of three families. This is a sound, format-independent base for the Studio's layout document.
- **Fonts.** Three app families (Bricolage Grotesque, Instrument Sans, Spline Sans Mono), not the client kit's display and body fonts. The Studio needs kit fonts loaded as web fonts with fallbacks recorded in the version.
- **Wrapping and export fidelity.** On screen the browser wraps text; on export `alExport` re-wraps with `measureText` on a canvas at native size. The two can disagree at line breaks, so a preview is not a guarantee of the export. The Studio should render the preview from the same layout engine as the export (one canvas renderer, or one SVG-to-PNG path), and store the export it produced.
- **Missing checks.** No overflow detection, no safe areas for platform UI, no minimum type size, no logo proportion guard. All four are needed for the "long headline must not silently shrink" requirement.
- **Interaction.** Pointer drag, resize and rotate with centre snapping; layer order, delete, properties. Keyboard operation is absent; the Studio needs arrow-key nudging and focusable layers.
- **Reuse decision.** Reuse the document model and the pointer interactions as the Studio's layout editor; replace the renderer with one engine used for preview and export; add the checks. Ad Lab keeps its entry point and its own state; the shared editor becomes a component both call.

## 3. Durable jobs

The constraint: a Worker request may run long while the client is connected, but work continued after the response lives about thirty seconds; the cron tick has minutes. The account's Cloudflare Workflows and Queues availability was not checked from the sandbox (no egress); the deploy script preserves bindings but adding a Workflow or Queue binding is a one-time dashboard change.

**Baseline (no new bindings).** A `studio_jobs` table in D1: `id, project, asset, stage, input_version, state (queued|running|done|failed|cancelled), attempts, lease_until, idempotency_key (unique), progress, cost, result, error, created, updated`. Stages: `extract`, `direct`, `copy`, `render`, `export`. A `POST /studio/job` with an idempotency key returns the existing job on repeat. Short stages (a text revision, a hand edit) run synchronously inside the request. Long stages are claimed by a runner with an atomic lease (`UPDATE ... WHERE state='queued' AND lease_until<now`), run from two places: the cron tick every 30 minutes for anything queued, and the browser's own `POST /studio/job/step {id}` which advances one stage synchronously while the tab is open and the lease is free. A terminated runner leaves an expired lease, which the next runner claims. Bounded retries (three for transient, none for invalid input or unavailable models). A stale result cannot overwrite a newer version: the write checks `input_version` is still the asset's current version and otherwise files the result as a branch. This is the pattern the sentiment and narrative work already proved.

**Upgrade.** Cloudflare Workflows, once bound, replace the cron runner with durable steps and built-in retries; the job table and routes stay as the contract, so the switch is internal. Recommendation: build the baseline in Phase 1, evaluate Workflows during Phase 2 against the live account.

## 4. Data model

D1 `studio_projects`, `studio_sources`, `studio_references`, `studio_directions`, `studio_assets`, `studio_versions`, `studio_context`, `studio_jobs`, `studio_approvals`, `studio_events`; R2 `studio/<project>/...` for originals, backgrounds, layout snapshots, export bundles; KV as cache only. Versions immutable; `restore` writes a new version with `restored_from`. Optimistic concurrency via a `revision` column on project and asset, checked on every write; on conflict the write is refused and both edits are shown. Namespace is stored on the project and enforced server-side for every child row; no request parameter can widen it.

## 5. Migration

Read-only adapters present `release_packs` and `content_sets` as projects (kind `legacy`). First edit imports explicitly and idempotently (`imported_from` unique). Flattened tiles stay flattened until rebuilt. KV sessions: `GET /studio/inventory` (Phase 1) lists `imgsess_*` keys with any client recorded in the document; import validates ownership; expired sessions are reported as not recoverable. `tools/studio-inventory.py` counts packs and sets per client today through the existing routes.

## 6. Model evaluation plan

Candidates: Opus 5.5 and Sonnet 5.5 for the creative stages (brief, directions, copy, critique), Sonnet 5.5 for extraction and adaptation, Gemini 3 Pro Image for rendering, Gemini 3.6 Flash for description. Identifiers are verified at deploy by `GET /studio/models`, which lists what the worker's keys can reach; nothing is hard-coded as fact. Evaluation set: eight briefs across two clients built from synthetic fixtures in the repo plus, privately, three real MCA packs already approved. Scored by two reviewers on brand adherence (rules applied, checked against output), factual accuracy against the ledger, copy quality, instruction following, revision precision, image fidelity to references, latency and measured cost per approved deliverable. Cost-bounded: a `STUDIO_DAILY_CALLS` budget and a per-job limit; the live evaluation needs a separately authorised allowance.

## 7. First-release scope (proposed, for decision 1)

Channels: LinkedIn, Facebook, Instagram, X. Formats: 1:1, 4:5, 9:16, 16:9, matching the current Release Desk and Ad Lab. Layout families: the teal fact panel (HOOF), the gold panel (national), a plain photographic panel. Deferred: TikTok, Reddit, YouTube, Spotify and email as copy-only channels (already in the Content Desk specs, kept), video, co-editing, portals, publishing.

## 8. Estimate (after the prototype)

Phase 1 four to five days; Phase 2 five to six; Phase 3 four to five; Phase 4 three to four. Seventeen to twenty working days, each phase shipped behind the existing views until Phase 4 retires the entry points. The estimate assumes the baseline job design; Workflows would add a day to Phase 2 and remove the cron runner.

## 9. Phases 1 and 2: what was built and what was decided

**Phase 1** put the durable ground under the prototype: projects that own every child row (the namespace a request supplies is never trusted), immutable versions with `restoreFrom`, optimistic concurrency by `revision`, locks, approvals by content signature, the job table with atomic leases, idempotency keys, bounded retries and the stale-result branch, read-only legacy adapters and idempotent import, `/studio/models` and the build id on `/engine/status`.

**Phase 2** is the production journey on that ground, with the models chosen by role and checked rather than assumed:

- **Models.** `CREATIVE_MODEL` (default `claude-opus-5-5`) for directions and copy; `EXTRACT_MODEL` (default `claude-sonnet-5-5`) for the ledger. `stClaude()` sends the 5.x models adaptive thinking and an effort level (`STUDIO_EFFORT`), and repeats a call plain if a deployment answers 400 to those fields, so an API change cannot stall production. Every call counts against `STUDIO_DAILY_CALLS` (default 200, KV `studio_calls_<day>`); an exhausted budget or an account spend limit fails the stage with the reason and no retry. Reachability is `GET /studio/models`; quality is the evaluation in section 6, still to be run live.
- **The ledger.** `extract` runs a rule pass (every figure with its unit and sentence, every quotation with its speaker) and, with a key, the model pass; the model's claims are verified against the passages (a figure must appear in the passage it names, a quotation must be verbatim) and kept but marked `unverified` when the source does not carry them. A brief is proposed only into empty fields and the assumption is recorded.
- **Directions and copy.** `direct` asks for two or three directions citing ledger ids (unknown ids dropped, near-duplicates flagged); `copy` writes one piece per channel from the chosen direction, the brief, the ledger, the kit block, the shelf examples and the learned corrections (`copy` and `tiles`), then checks every piece deterministically: matches / differs (value or unit, with what the source says) / unsupported / approved fact / banned term (negation-aware) / over the limit / hashtags / overflow at the format. Checks are recomputed on every hand edit. "Matches source" is never called verified.
- **Compositions.** The layout document is the Ad Lab layer model in per cent of the stage: a panel (teal for Hands Off Our Fuel, gold for the national campaign, plain otherwise, or the kit's primary), headline, support, CTA and the logo as an exact image layer from the brand kit. `docs/studio-render.js` is the one renderer: the preview canvas and the export PNG are the same function at different widths. A text or layout change is a version with the same image and no image-model call; a background is a `render` job per asset, queued by the copy stage with an idempotency key and run by the browser's step loop or the cron.
- **Export.** The export stage takes exactly the versions whose approvals stand (copy for copy-only assets, copy and design otherwise), writes the manifest and a copy sheet to R2, references the browser-rendered PNG saved through `/studio/render/save`, and sends nothing anywhere; the bundle downloads as a zip built in the browser. ClickUp is a separate, confirmed dialog.
- **Not in Phase 2, by design.** Direction by instruction (revise, alternatives, adapt to a channel, regenerate on request) is Phase 3; the composer records a note to the team meanwhile and says so. The layer editor UI beyond headline size is Phase 4. Rebuilding a flattened legacy tile as a composition is later.
- **Harnesses.** `tests/studio-p2-worker.mjs` (11 cases, one per acceptance line above) and `tests/studio-browser.mjs` (11 cases, the journey in a real browser through the worker module in-process).

## 10. Phases 3 and 4: direction, and one entry point

- **Direction is one decision per instruction.** The model is asked first what the instruction is - a text change, a layout change, alternatives, a new image, an adaptation, or a question - and the worker applies only that. Text and layout changes are versions with no render; alternatives are offered and applied only when chosen; a new image is proposed with its steps and runs only on confirmation, one render job per asset by an idempotent key tied to the proposal; an adaptation reuses the image. Locked fields are never written and are named in the reply. An ambiguous pronoun aimed at the set is asked about before the model is called.
- **Remember is a question, and campaign scope is real.** A standing preference the model detects rides on the event as an offer; nothing is saved until the team answers campaign, client or no. A campaign preference is an `engine_fixes` row whose source carries the campaign id, and every reader of the rules (the Studio, the Content Desk routes that remain, the Release Desk composer) filters such rules to the campaign at hand. Approve and reject file WIN and LOSS exemplars, as the proposal asked.
- **One entry point.** The Release Desk and Content Desk are intake presets of the Studio; their nav buttons are gone and their sections stay only so the redirect and their routes keep working. The Sentinel drafts into the Studio. The Client Central Studio tab is the Studio. Ad Lab keeps its tab, as decided.
- **The Client panel** reuses the Content Desk's voice profile editor and adds a Learned table that shows scope (campaign, client, every client) with switch off and delete. **The layout editor** overlays the layers on the same renderer used for preview and export: drag, resize, keyboard nudging, saved as a layout version.
- **KV sessions** import as flattened artwork with the images copied to R2, once, and only when the session recorded the client and still holds images.
- **The golden set** is `tools/studio-golden.py`: cases and baselines live outside the repo; a run re-produces every case with renders off and exits non-zero on any change in copy, checks or context counts. It spends model calls and is meant to run before a prompt or model change ships.
- **Not done, stated.** Live model quality has still not been measured (section 6): the sandbox has no egress, and the evaluation needs an authorised allowance. Rebuilding a flattened legacy tile as an editable composition is not built. The Release Desk's tile-pack renderer (text painted into the image) is untouched and unreachable from the nav; the Studio's compositions are the way forward.

## 11. The re-render area as an art director

The re-render box was an image button: a description in, a photograph out, and a skate park behind a fuel tax credit tile when the description was thin. It is now an art director's desk. Feedback on an asset goes to the creative model with the artwork itself attached, and the answer is a critique and three or four distinct directions, each a deterministic layout variant the renderer previews on the current photograph before anything is applied: a larger panel with a stronger hierarchy, a compact container, a translucent panel, no box over a darkened image, a gradient overlay, a split field. Every card says what it keeps and what it changes, what it rests on (a stated brand rule, a recorded preference, or the model's inference), what the brief and the kit do not give, whether it needs a new photograph, and what that costs. Applying a card is a layout version with no render; a render is queued only when the card needs a photograph and the team asks for it, with a prompt grounded in the words on the tile and barred from unrelated scenes. Layers can be hidden and locked one by one, and locked layers keep their place through every direction. The supplied Minerals Council logo goes into the kit as a file through `tools/brand-logo.py` and is placed exactly, only on that client's work.

