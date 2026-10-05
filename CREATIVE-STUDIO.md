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

## 12. Design, not a template: how the art director now works

The compositions were one geometry: a panel in the lower third, white type, logo bottom right, and a different photograph each time. That treatment stays as the house default, but it is now one point in a vocabulary the models fill in and the layout engine draws.

**The design spec.** Every composition carries `layout.design`: a concept and objective; an image brief (keep the photograph, or subject, setting, framing, lighting, mood and where the subject sits); a composition (style `panel` / `translucent` / `none` / `gradient` / `split` / `typographic`, the zone the words occupy, how much they cover); type alignment and a running headline-size delta; the panel fill and opacity; the logo corner (including inside the panel); the CTA as a button or as text. `stLayoutFromSpec` turns a spec into layers for any format - the gradient darkens from the zone's edge, a split gives the photograph its own region (`layout.image`) and crops it there, a typography-led tile fills the stage with the brand colour and shows a small photograph in the opposite corner - and type scales with the column and steps down until the stack fits the zone; when the words are simply too long the boxes stay bounded by the zone so the fit check flags the overflow rather than hiding it. Locked and hidden layers carry through by role. The old entry (`stLayout`) builds a spec from its arguments, so first production and adaptation take the same path, and the creative team may now give each piece its own composition at production.

**References reach the models.** A reference uploaded to a project is read by a vision pass (the extraction model, one call) into typography, colour relationships and palette, hierarchy, composition, image treatment, panels, spacing, logo treatment, the words on it and takeaways, stored on the row; a reference the model cannot describe is stored as the limitation and shown as "not analysed" with a retry. `stRefBundle` ranks references by purpose (approved, brand, composition, typography, mood, imagery, inspiration), attaches the strongest as images beside the artwork, and tells the model how to read each purpose: brand and approved references are constraints, an approved layout is an example with room for variation unless the note says mandatory, the others speak to their one respect, inspiration lends nothing exact. The client's catalogued artwork (`engine_art`, that client only) rides along. The concepts, revise, copy, direct and suggestion prompts all receive this.

**Distinct alternatives, combinable.** "Come up with a better creative" or "Give me different variations" returns a critique and three or four directions that differ in composition, each a spec laid out for the asset's format and previewed on the current photograph, with what it draws on (a named reference, a rule, a recorded preference, an inference). At least one keeps the photograph; at most two need a new one. A card applies as a layout version; its layout can be applied with the photograph of another card (`imageFrom`), and the render prompt then describes the photograph for that composition's quiet zone rather than a fixed lower third.

**Combined directions.** The revise stage gained the kind `design`: "use a split layout and create a wider photograph" is one answer - the composition is applied now as a layout version on the current image, and the photograph is proposed through the existing confirmation with the affected assets and the render count; a design that needs no photograph spends nothing.

**Suggested next directions.** `POST /studio/suggest {asset}` asks the extraction model, with the tile, its words, the brief, the kit, the references and the recent feedback, for three design suggestions and three photograph suggestions, each specific and ready to send; cached on the asset's version, its references and the last event, refreshed on demand. In the Studio the design suggestions sit beside the Creative Partner and fill the composer as editable text, the photograph suggestions sit inside the re-render controls and fill its description.

**Verified** in `tests/studio-p6-worker.mjs`, the suggestions and export-equals-preview case in the browser harness, and `tests/studio-variations-demo.mjs`, which draws the house default and four directions for one message onto one sheet.

## 13. Design beyond the preset: the concept decides the medium

The comparison sheet in section 12 proved layout mechanics. This slice removes the assumption behind them: that every creative is a photograph with words arranged into one of a few presets.

**The plan.** A concept now arrives as a plan: a medium (cinematic or documentary photography, editorial design, surreal compositing, cutout imagery, collage, illustration, diagram, infographic, typography-led artwork, or a carousel), an approach, image regions each with its own instructions and references, free elements in per cent of the stage (text groups with emphasis, rules, shapes, overlays, gradients, rotation), a stage colour or gradient, and frames for a carousel. The normaliser keeps everything the renderer can draw and names what it cannot in `unsupported`, which the cards show as "cannot draw" rather than quietly falling back to a panel. The presets of section 12 remain starting points inside this vocabulary.

**Two honest approaches.** *Editable composition*: the image model makes the imagery of each region and the shared renderer composes the words, shapes and marks as live layers; the finish comes from typography, hierarchy and layering, which the renderer now supports. *Full artwork*: the image model paints the whole designed piece, lettering included, from the exact approved words; the version is marked `artwork`, its baked roles are named, the fields are disabled with "in the artwork", and only the mark stays a live layer placed from its original file. Neither claims what it cannot deliver.

**Campaign identity is not content type.** Kit campaigns carry an identity note, a logo policy and a wordmark file. Hands Off Our Fuel tiles carry the HANDS OFF OUR FUEL wordmark and never the MCA logo; MCA campaigns carry the MCA logo; myth-busting is a format either can use. The marks are placed exactly, on preset and plan layouts alike.

**Three actions.** Refine this design keeps the idea and improves it in named ways. Explore variations develops three concepts that must differ in the drawn result, measured on medium, approach, image region and where the words and images sit, not on their names. Create a new design works independently of the cards: an instruction, the references to use, and what to retain (imagery, copy, composition); mandatory campaign requirements always carry forward; the panel and layout never do; the result is a fresh asset, or one asset per frame.

**Claude as the art director.** The concepts call runs Claude Opus 5.5 at high effort with the artwork, the chosen reference images, the brief, the audience, the message, the campaign identity, the approved facts and the recorded preferences, and requires a critique and an executable plan per concept.

**Gemini gets the whole plan.** Each region's brief is written in the medium's own terms, the universal "documentary realism, natural light" is gone, the reference images go to the image model with their roles spelled out, edits replay the conversation the image came from (the model's parts and thought signatures kept), 2K stays the default with 4K on request, and the model and resolution actually used, and any fallback, are recorded on the version and shown.

**Inspection.** After every render the art director reads the actual result for fidelity, hierarchy, readability, image relevance and campaign identity, lists the words it can read against the approved copy, and offers one correction, applied once from the thread and bounded to two rounds per line.

**Demonstration.** `tests/studio-plan-demo.mjs` draws the mechanics with synthetic imagery and says so on the sheet. The finished work, with the real models, comes from `tools/studio-showcase.py` against the live worker: the MCA myth opener and fact-response carousel, the HOOF myth / fact creative with its wordmark, and a fresh concept through Create a new design, saved before and after with the inspections and the facts about each render. The sandbox that builds AXIOM cannot reach the models, so that is where the quality is judged.

## 14. A production-quality, client-aware workflow (build studio-p8)

Reviewed baseline: commit 110a6f9, build studio-p7. This slice closes the gaps between the art-direction tools and a production line a client team can rely on.

**One pipeline from the brief.** First production now runs through the same plan engine as art direction. The creative team plans each channel at high effort with the reference pack attached; `stPlanNormalise` lays the plan out and `stPlanRenders` queues each region's imagery with the references it names, at the resolution the team chose. A piece that comes back with no plan, or a plan that places no words, falls back to the house composition and the version says so; it is never silent. A complete brief goes straight to production (the quick route); an open one still gets directions first.

**The brief is checked before anything is spent.** Objective, audience, message, action and deliverables are searchable, editable fields whose suggestions name their source: approved (the kit's own records), preference (a learned correction), previous brief, reference, or AI (only on request, one call). Design requirements sit in three bands, mandatory, preferred and open, each item with its source, and reach the model with it. `GET /studio/brief/check` lists the gaps: with more than one campaign the first is never assumed; a brief with no objective, no message, no source, no direction and no instruction has nothing to write from and stops production unless the team acknowledges the stated assumptions; a missing campaign mark is named as blocking approval. Assumptions are recorded on every version made from them.

**Identity is enforced on the server.** A campaign's logo policy is mandatory: a plan that asks for another mark is overruled and the layout says so. A mark the policy needs but that is not on file is never drawn, substituted or replaced by another campaign's; the composition is marked incomplete, a `mark_missing` check names it, design approval is refused (409) and export leaves it out. Mark placement is learned only from approved and brand references whose analysis describes a corner; otherwise the house default applies and the audit says so. `GET /studio/identity?ns=` (and `tools/studio-identity.py`) reports what is actually in R2 per campaign, the references by purpose, the observed placement, the recorded tile preferences and the gaps.

**References are a visible pack.** Each concept, and first production, sees a pack grouped as identity and marks, approved designs, composition and typography, imagery and mood, and inspiration, in one of three modes: recommended (another campaign's references excluded and named), chosen, or none. The event records what was attached as an image, what was read only by analysis, what was excluded and why, and what had no image to show. An original over the models' 4.5 MB limit is kept exactly; the browser prepares a smaller copy that stands in for it.

**Retain means retain.** Kept imagery, copy and composition hold in planning (the plan is rewritten to keep the current image; the model's headline is not taken) and again in application. Explore measures distinctness on the drawn result and sends look-alikes back once with the measure; a second failure is marked, not hidden.

**Gemini, honestly.** The size chosen on Generate reaches the render. An edit history is replayed only to the model that made it; a fallback model gets the current image attached instead and the version says so. The final image is the last non-thought image part. Regions rendered from the same version merge into the current version instead of branching. A cutout's PNG header is checked for transparency and an opaque one is named. Each image records the references given, the model asked and the model that answered, the size asked and made, the time and the usage.

**The inspection reads the finished tile.** Before an inspection runs, the browser (or `tools/studio-compose.mjs` from a Mac) draws the composition with the one renderer and saves it as that version's export; the inspector sees the composed tile, the complete text inventory (free text included), the marks that should and should not appear, and the sibling frames of a carousel. Without a composed export the event says it judged the imagery only. A correction aimed at an earlier version is refused unless the team chooses to apply it anyway; a ship verdict is an opinion and never an approval.

**The interface.** The intake asks for the campaign when the kit has several; the brief view carries the combos, the requirement bands, the check and the draft or final resolution; concept cards move through proposed or sketch, queued, generating, generated, reviewed, approved or failed, and show what was retained, whether the mark is missing and the reference pack with thumbnails; the asset view shows the family (carousel frames, master and adaptations), what the render actually was, and refuses design approval while incomplete; suggestions are grouped as design, type, copy and concepts with their basis, what changes, what stays and whether they cost a render; the client context shows the identity audit. Adaptation re-plans the master's own plan for the new format.

**Showing it.** `tools/studio-showcase.py` now prints its estimate and runs nothing paid without `--approve-budget N`, holds any render past the cap, composes every tile with the app renderer before the inspection, and builds an index that compares composed tiles and discloses model, resolution, references, fallbacks and what the inspection saw. The sandbox cannot reach the models, so the finished renders still come from the user's machine.

## 15. Typography, layout validation and production readiness (build studio-p9)

Reviewed baseline: commit 2174332, build studio-p8. The defect that started it: a HOOF tile whose three-line headline ("A new tax on the people who grow our food") ran into its support line, a blue wordmark that barely read on the dark scrim, and an inspection that answered ship while listing problems. The original asset was not retrievable from the build sandbox, so `tests/fixtures/studio-layouts.mjs` carries a labelled reconstruction read off the screenshot.

**Root cause.** The renderer wrapped by measuring but drew every text layer at its fixed position whatever height its lines took, collapsed explicit line breaks and never broke a long word; nothing compared one layer's real extent with another's. The worker's fit check (`stFit`) was a character-count estimate, blind to fonts and to collisions, and neither approval, export nor the inspection consulted it. The island drew before the web fonts had loaded and redrew only when the background or logo changed; a failed image load was cached as nothing. The house CTA box ignored the button's own padding. The inspection's verdict stood on its own.

**One measurement, one rule set.** `docs/studio-render.js` (renderer `studio-render/2`) lays out each text layer once (`layoutText`) for both drawing and measuring: lines, size, padding, and the space really occupied including highlight, underline and box emphasis and the rotated bounds. `measure()` reports every layer at the output size; `layoutRules()` judges the boxes - blocking: duplicate id, impossible geometry, overflow, a line wider than its box, type under 1.8% of the width, unreadable contrast, a collision between any two of words and marks (a declared `overlaps` exception covers that pair only), off the stage, the Instagram story interface; warnings: a broken word, small type, low contrast (4.5:1 for a wordmark), a font fallback; production-dependent: an unloaded mark, a sketch or missing imagery. The same function, byte for byte, runs in the worker between `RULES:BEGIN` and `RULES:END`. `ensureFonts()` loads and waits for every face the words use and reports, per role and weight, the family that actually drew; the compose tool reads the app's font link from `index.html` so the two cannot drift.

**Evidence the server keeps.** A browser (or `tools/studio-compose.mjs`) measures at the output size and posts the report and the PNG to `POST /studio/validation`. The worker never takes a client's verdict: `stValidationJudge` checks the report against the version (output size, every layer present, positions within 1.6 px, the number of displayed characters, the type size, a plausible line count, the mark file) and refuses a mismatch with 422; it then rebuilds the boxes and applies the shared rules itself. The row in `studio_validations` is tied to `stCompSig`: the displayed words, layout, imagery, mark files and their versions, fonts, format and stage. `GET /studio/readiness` reports three separate things - technical (not validated, stale, failed, passed), the art director's assessment, and human approval - and the reasons. A caption is posted beside the tile, so a caption-only version carries the evidence and the design approval; a change to any displayed word, or a new file for the campaign's mark, makes it stale.

**Gates.** Design approval needs a passing validation of exactly the current composition (409 `not_validated` / `validation_stale` / `validation_failed`); painted words in artwork mode need an inspection that read every one back; an inconsistent inspection needs a person's acknowledgement, recorded on the approval, and that acknowledgement never overrides a technical blocker. Export leaves out anything not technically passed for what it shows and records the validation, the imagery and the output size. A draft PNG can always be downloaded.

**Repair.** `STRender.repair()` makes the smallest geometric correction and never changes a word: boxes take the height their lines need, related blocks restack with explicit gaps, a column moves up clear of the safe bottom or a mark (never past what sits above it), panels and scrims refit, a crowded block widens into free space, a mark comes in from the edge in its own corner or moves to a free corner only when no approved reference fixes its placement, then bounded type steps (to 82%, above each role's readable minimum). A mark that reads badly takes the approved variant that measures best against what is actually behind it. Locked layers are never moved; when they make a fix impossible the answer names them; when geometry cannot fit the words it says how much shorter the copy would need to be and leaves the cutting to a person. The fix is saved as a layout version: no model, no render. The worker's 9:16 house layout now starts clear of the story interface.

**Inspection.** The art director sees the composed export, the deterministic issues of that tile, the whole text inventory (free text included), the painted words to read back and the campaign's marks. Findings carry a severity; a ship verdict with a blocking or material finding, unreadable or unapproved words, or a failing measurement is recorded as an inconsistent assessment. The inspection reads the export the current evidence points to.

**Words and figures.** Every displayed layer is checked, not just headline, support and CTA. A figure matches an approved fact of this campaign or a source passage, in the same unit and period; dollars are not cents, a dropped unit and a different year are differences; a pending fact or another campaign's fact is named as such; a number only in the brief or kit prose is unsupported. Suggested copy with an unsupported figure is flagged and never presented as a rule.

**Identity.** Campaign wordmarks are stored as approved variants side by side (`wordmarkVariant`, `wordmarkTone` light / dark / colour, `wordmarkDefault`) under immutable content-versioned keys, served by `/brand/wordmark?variant=&v=`; the logo has the same immutable versions. A composition carries the versioned src and the alternatives; repair and layout pick by measured contrast or by the ground. Nothing is redrawn. `tools/brand-logo.py --variant --tone --default`. HOOF's three supplied files (blue, white, black) are client assets and are uploaded by the team, not by the build.

**Stale and duplicate work.** A region render whose region has since been removed branches off the version it was asked for; a render that returns no image writes nothing; the same request is the same job.

**Proof.** `tests/studio-layout-browser.mjs` (64 checks in real Chromium, including the worker's own layouts in four formats) and `tests/studio-p9-worker.mjs` (14); before and after in `tests/shot-layout-repair.png`, synthetic and labelled so.

**Limits.** The live HOOF asset was not inspected; the reconstruction stands in. The worker trusts the measured boxes it is sent within its plausibility checks - it cannot run a font engine - so a full-role key could file a crafted report; the checks make an honest mistake impossible, not a deliberate forgery. Approvals recorded before this build will not stand after deploy for compositions (the design signature now includes the displayed words) and every composition needs one measurement, which the app files on opening.

## 16. Toward an agency-grade production platform: research, audit, plan, and the first slice (build studio-p10)

Reviewed baseline: commit 34efc4b (build studio-p9, merged to main 1 October 2026), plus the two fixes that followed: the resolution select now reaches every render path (a6a744e), and a request's size wins over the worker variable IMAGE_SIZE, which until then overrode every render (c1fb86a). Whether studio-p9 is deployed could not be checked from the build sandbox; the worker answers its build on `/engine/status`.

### 16.1 What the reference products show (and how sure we are)

The five pages named in the request could not be fetched: the sandbox's egress proxy refuses higgsfield.ai, runwayml.com and runway.com, and ai.google.dev as well. What follows comes from web-search excerpts of those vendors' own help and product pages, and is labelled by how sure it is.

- **Verified from the vendors' own pages (via search excerpts).** Runway Workflows are node graphs: nodes take inputs from other nodes, content types are colour coded, and workflows can be published as apps or endpoints. Runway References use up to three reference images per generation; a reference can be tagged with a name and recalled with @name in any prompt. Runway's Team plan gives a shared workspace where assets, references and Brand Kits live in shared projects, with pooled credits and frame-accurate comments. Higgsfield Marketing Studio starts from a product URL and a chosen format (product shots, UGC, ads, posters and others), with reusable, pinned avatars across campaigns. Gemini 3 Pro Image takes up to 14 reference images (Google: up to 6 object, 5 character and 3 style images), edits by semantic, text-described masking rather than a pixel mask, and makes interim "thought images" before the final one.
- **Third-party claims, not relied on.** Figures such as "94% text accuracy" or a "16-bit colour pipeline" come from review sites, not the vendors. A Google developer-forum thread reports `imageSize` being ignored by one SDK. Our worker sends `imageConfig.imageSize` over REST and now records the pixels it receives, so the question is answered by measurement, not belief.
- **Architectural inference, not knowledge.** Nothing here says how those products orchestrate models internally, and nothing is assumed about their APIs.
- **Our decisions, translated.**
  - Named, reusable references become the Brand Workspace: references with authority and scope, recalled by campaign.
  - Guided creation becomes the two routes: quick production and guided development.
  - Workflow graphs become recipes over a dependency graph that ordinary users never have to draw.
  - Team consistency becomes campaign-scoped memory with reviewed updates.
  - Semantic editing becomes instruction-led edits whose preservation is compared afterwards, since no pixel mask is available.

### 16.2 Audit of the Studio against the request

- **Already working and preserved:**
  - sourced brief combos with requirement bands and a check before spending (P8)
  - campaign identity enforcement and reference packs (P8)
  - free-form plans and diverse concepts: explore, refine and Create a new design (P7)
  - editable composition, full artwork and flattened legacy assets, kept distinct
  - retain controls, immutable versions and component approvals
  - durable jobs with leases, idempotency, the stale guard and budgets
  - the shared renderer, composed-tile inspection, and P9's measured validation, repair and server-enforced readiness (verified present on main)
- **Incomplete:**
  - brand knowledge was scattered across the kit, R2, references, engine_fixes and outcomes, with no provenance, authority or history in one place
  - wordmark variants had a back end but no interface, and the identity audit ignored them
  - a kit save without a new logo dropped the logo's version (fixed here)
  - nothing showed what a production actually used
  - strategy is folded into directions instead of standing as its own stage
  - the canvas lacks align, group, reorder, undo/redo, typography controls and safe-area guides
  - a campaign set is per-channel copy, not a planned sequence
- **Missing:**
  - client review: scoped, revocable and expiring sharing, comments, pinned annotations
  - delivery bundles per client
  - recipes and selective re-runs over a dependency graph
  - outcome metrics: time to first usable concept, revisions, cost per approved asset
  - a third-client demonstration

### 16.3 The plan, by dependency

1. **Phase 1: the ground.** P9 typography, validation and readiness (done). The Brand Workspace, brand readiness and "What the Studio used" (this slice). Next in this phase: the strategy stage as a structured brief document shared by every later stage.
2. **Phase 2: exploration and craft.**
   - Three directions by default with an exploration budget, a strategy rationale and a measured diversity score (P7's plan signature).
   - Board, Canvas, Copy and Review views.
   - The canvas: align, group, reorder, undo and redo, typography controls and safe-area guides.
   - Targeted refinement on a selected element, with preservation compared before and after.
3. **Phase 3: production at scale.**
   - Recipes over a dependency graph (brief, references, copy, imagery, composition, adaptations, review), re-running only what changed and keeping what is locked.
   - Campaign sequences with asset roles.
   - Agency review, then client review through scoped, revocable, expiring links with comments and pinned annotations.
   - Delivery bundles, and metrics with baselines measured first.

### 16.4 Delivered in this slice

- **The Brand Workspace** (`GET /brand/workspace?ns=&campaign=`, read role) assembles a client's knowledge, for the whole client or one campaign. Each item is normalised with:
  - **authority:** approved rule, reference observation, preference, project decision, or AI inference
  - **scope:** the whole client, or one campaign
  - **status:** active, proposed, retired, or outdated
  - **source:** where it came from

  It draws on the kit, the marks actually in R2, references across the client's projects, learned corrections, accepted and rejected work, catalogued artwork, and the new `brand_items` (`POST /brand/item`, `/brand/item/update`, `/brand/item/review`, full role). An AI inference is always a proposal and cannot be switched on as it stands. A proposal is kept with a chosen scope and authority, or dismissed with a reason. Every change is a revision with its reason (`/brand/item/history`).
- **Kit history.** Every kit save writes a revision in words with the kit as saved (`brand_revisions`, `GET /brand/revisions`). Logo uploads keep a version list. Re-uploading a wordmark variant keeps the earlier version in that variant's history, and every version stays under its own immutable key.
- **Readiness** (`brReadiness`), shown in the workspace and on the brief check, covers four things:
  - **Blocking:** a mark the campaign policy requires is not on file.
  - **Gaps:** only the unnamed single wordmark slot, no light-and-dark pair, no fonts, palette or voice, no identity note, no brand or approved reference, no observed placement, no approved facts, or proposals waiting.
  - **Conflicts:** both the single slot and named variants exist; a banned term sits inside approved knowledge; two approved facts disagree; a preference speaks of the client logo on a campaign that does not carry it.
  - **Review:** unanalysed references, facts naming an old year, pending facts.
- **The wordmark library in the page.** Named variants with tone, version, default and history are shown on a light and a dark ground. They are uploaded through the page with a name and a tone, and "make default" chooses between them. The old single slot is shown as what it is, never as a library. HOOF's three supplied files (blue, white, black) are uploaded by the team; the build never did.
- **Reviewed memory.** An approval or rejection whose reason runs to twelve characters or more becomes a proposed `accepted` or `rejected` item, with its project, asset and version. Nothing writes a learned rule from it until a person keeps it.
- **What the Studio used** (`GET /studio/used?asset=&version=`, read role; a panel on every asset). It names:
  - the version that made the words and plan, with its model and concept card
  - the version that rendered the imagery, with its model, size, pixels received, reference images and brief
  - hand edits since then
  - the reference pack: attached, read, left out and why
  - the learned rules applied, and whether they are still in force
  - the count of approved facts and banned terms
  - the kit revision in force
  - the marks with variant and version
  - the assumptions the brief proceeded on
- **Identity separation holds by construction.**
  - MCA work carries the MCA logo under the logo policy.
  - HOOF carries its own wordmark variants and never the MCA logo, and a preference that says otherwise is reported as a conflict.
  - A myth-busting format does not change which identity applies.
  - Another client's items, facts, references, marks and history never appear, and cannot be edited by naming another namespace.

### 16.5 Proof and limits

- **Tests:**
  - `tests/studio-p10-worker.mjs` (9): history, readiness, the variant library, authorities and scope, conflicts, items and reviews, proposals, isolation, used.
  - The P10 case in `tests/studio-browser.mjs` (19 cases in all): the Brand view, keeping a proposal, uploading a named variant through the page, the used panel.
  - `tests/studio-p9-worker.mjs` (15): adds size precedence and the cap.
  - Every earlier Studio suite still passes.
- **Not done in this slice:** the strategy stage, the canvas upgrade, recipes, client review, delivery and metrics (see 16.3).
- **Not measured:** the effect on creative quality. No real model was called; the demonstration with real models waits for an approved spending cap.

## 17. Client review (build studio-p11)

The second slice of the plan in s.16.3 is the agency-to-client loop.

**Sharing.** It is private by default and explicitly scoped:
- a link per review, naming the assets the client may see
- a random 256-bit token shown once and stored only as a hash
- optional expiry (7, 14 or 30 days, or none)
- withdrawal at any time
- a lockout for an address that guesses
- no AXIOM key and no storage URL ever reaches the client

**What the client sees.** Only work that is finished enough to judge: a composition appears once its current version has passed the technical validation, as exactly the export that would be delivered. A version in progress reads "in revision". Copy-only assets read as copy. The client never sees the thread, internal notes, checks, layouts, other assets or another client.

**What the client does.** The reviewer gives a name, comments (optionally pinned to a point on the tile), requests changes, or approves. Approval is only possible when the link allows it and the agency has approved the version itself, and it is of that exact version: a new version needs a new approval.

**The agency's side.** The agency sees every comment with its pin on the thread and in the Client review view. It resolves each comment by naming the version that addresses it (not an older one), or answers it without a change. The client then sees "addressed in version N".

**Delivery.** The manifest records the client's decision per asset and can be told to require it.

**Proof.**
- `tests/studio-p11-worker.mjs` (8) covers the token hash, the allow-list, pins, stale versions, approval order, resolution, the manifest, revocation, expiry, lockout and isolation.
- `tests/studio-review-browser.mjs` (5) runs both pages in Chromium: the page never sends an AXIOM key, a comment is pinned, the client approves, the agency resolves, the client sees the new version, and the link is withdrawn.

**Not yet.**
- Delivery bundles sent to the client.
- Reviewer identity beyond the name typed (an email one-time code would be the next step if needed).
- Comment threads with replies.

## 18. Strategy, exploration and the campaign sequence (build studio-p12)

The third slice of the plan in s.16.3 covers two routes into the work and three stages that make a campaign set a campaign.

**Routes.** The intake asks which route the work takes:
- **Quick production** is for a clear, approved brief and goes straight to production, as before.
- **Guided campaign development** reads the source, drafts a creative strategy, and proposes three directions. Nothing is produced until someone chooses.

**Creative strategy.** The strategy is one structured document on the brief:
- the communication problem
- the audience: who they are, what they believe now, what the work wants them to believe, and the insight
- the campaign idea and the proposition
- proof, limited to ledger claims the project actually holds
- tone and what to avoid
- risks
- how the team will judge it, as signals rather than forecasts
- the questions still open

The model drafts it as a proposal; the team edits it and confirms it. Every later stage reads it: directions, the sequence, copy and concepts.

**Exploration.** Directions take an exploration budget of one to five, three by default. Each direction carries:
- its idea and copy approach
- medium, composition, typography and colour
- the references it draws on
- a production plan and the images it would need

The set's diversity is measured (1 minus the mean overlap between directions, with a penalty for sharing a medium). A look-alike is flagged rather than presented as new.

**Sequence.** A campaign set is planned as one argument told in order. Each asset has a role, a channel and format, a day, a purpose and its relation to the idea. Every item is made as an editable composition in its own family with no image spent; imagery is asked for per asset when the team wants it.

**Proof.** `tests/studio-p12-worker.mjs` (5) covers:
- the strategy drafted, then confirmed and read downstream
- the budget, the new direction fields and the diversity score
- an ordered sequence made with no render
- the brief kept whole

The guided case in `tests/studio-browser.mjs` runs the same journey in the page.

**Not yet.** The canvas upgrade (align, group, reorder, undo, typography controls, guides), recipes with selective re-runs, and outcome metrics.

## 19. The canvas, Board and Copy deck (build studio-p13)

The fourth slice brings the professional design workspace from s.16.3, Phase 2.

**The canvas.** The layout editor is now a canvas:
- **Undo and redo:** every finished gesture or command is one step, from buttons or the keyboard.
- **Selection:** several layers at once (Shift-click).
- **Align and distribute:** to the selection's bounds, or to the stage margin for one layer.
- **Paint order:** for the whole selection, keeping its internal order.
- **Groups:** grouped layers move together.
- **Typography:** size, weight, alignment, tracking, colour and emphasis for the text layer last clicked, even inside a group.
- **Safe-area guides:** the 3% margin, and the story interface hatched on a 9:16 Instagram tile.
- **Keyboard:** nudges move the selection.

It measures the working layout with the same `validate()` the readiness uses, at the output size, outlining any layer that blocks. A save is one layout version with no render, and the version then goes through technical validation like any other.

**Board and Copy deck.** Board shows the whole project by family, each asset drawn by the renderer with where it stands. Copy deck holds every word in the project in one table, editable in place; each edit is a text version checked against the ledger, the facts and the banned terms.

**Views.** Board, the asset's canvas, the Copy deck and Client review are the four views the request named. Technical job logs stay under Jobs, out of the creative path.

**Not yet:**
- recipes with selective re-runs (s.20), and outcome metrics
- image editing on a selected region, which needs Gemini's semantic (text-described) masking, with preservation compared afterwards

## 20. Recipes, impact and usage (build studio-p14)

The fifth slice is s.16.3, Phase 3: dependable production without a node graph.

**Recipes.** A recipe is a list of stages in order, saved for a client or for one of its campaigns. Four come built in: a guided campaign (strategy, then three directions), release to a coordinated set (read the latest source, then write and lay out a piece per channel), strategy then a four-asset sequence with no images, and deliver what the client approved. A step may name `$latestSource` or `$briefChannels` and the project fills it in.

**Cost first.** The estimate comes before the run: model calls (counting one inspection per image), images, and the size from the brief. It is an estimate, and says so: a plan with several image regions renders more. A recipe that renders is refused without `confirm`, and the Studio asks in words ("would generate about 4 images and 6 model calls") before sending it. Usage afterwards is counted from the jobs that ran, not from the estimate, so the two can be compared.

**Chains that fail honestly.** Each step is a durable job that names the step before it. It is not claimed until that one is done. If the upstream fails or is cancelled, the step fails as `upstream_failed` and is not retried, so nothing runs on a broken input. The browser leaves a waiting step for the next round, and the cron finishes a chain when the tab closes.

**Impact: selective re-runs.** The Production view lists what an upstream change made stale, asset by asset, with the remedy and whether it costs anything:
- **Kit changed** (facts, banned terms, standing rules or voice revised after the words were written): re-check, free. The checks are recomputed against today's kit, and a rewrite is offered only if they now flag something.
- **Strategy confirmed later:** revise, one model call.
- **Master changed** (an adaptation's master has a newer version): re-adapt, one model call.
- **Measurement stale:** open the asset to measure it again, free.
- **Client approved an earlier version:** share again, free.

Locked fields are named beside each asset, and the paid remedies keep them.

**Proof.** `tests/studio-p14-worker.mjs` covers estimate, confirm, chained claiming, upstream failure, impact and usage. The P14 case in the browser harness covers the kit-change re-check with no model call, the confirm on a rendering recipe (dismissing it starts nothing), and a two-step recipe running in order with no image.

**Not yet:**
- outcome metrics with baselines (s.21)
- the six-step demonstration
- region editing through Gemini's semantic masking

## 21. Outcome metrics against a baseline (build studio-p15)

The request asked for metrics with baselines and no fake certainty. Each figure is a count over rows the Studio already records. Nothing is a model's impression, and nothing is estimated.

**What is measured, per client and window:**

| Measure | Counted from |
|---|---|
| Time to first draft | project created to its first version |
| Time to a validated composition | project created to the first validation with `ok=1` |
| Time to first approval | project created to the first agency approval |
| Versions per approved asset | versions up to the standing approval (copy, and design unless copy only) |
| Spend per approved asset | finished model calls and images over fully approved assets |
| Constraint adherence | current versions with no figure that differs, nothing unsupported, no banned term, no missing mandatory mark |
| Technical validation passed | latest validation of each current composition |
| Rejections and client decisions | agency rejections; client changes asked and approvals |

**Baselines.**
- **The same client's previous window** of the same length.
- **The Release and Content Desks** over the same window, measured the same way where they recorded something: first Approve, revisions per content set, figure and banned-term flags.

Where the desks recorded nothing, the table says "not recorded", not zero. They never measured a composition, never kept versions of a tile, never counted spend per pack and had no client review.

**Reading it.** Every median carries its n. A project without the event is left out of the median, not counted as zero. Small numbers are small numbers.

**Isolation, audited.** Every rule, reference and mark recorded on the client's current versions is read back and checked against the client. Recommended references and wordmarks are also checked against the asset's campaign, so an MCA tile carrying an AEP rule, an AEP logo or the national wordmark on a HOOF asset is named.

**Proof.** `tests/studio-p15-worker.mjs` builds two windows and the desks' rows and checks each figure. It also checks the wall between clients, and that the audit names a planted rule, logo and wordmark. The P15 browser case reads the panel.

**Limits.** Until the deployed Studio has run real projects, these metrics describe test data. The first honest reading comes after a few weeks of real work. Comparisons with the desks are fair only for approval time, revisions and figure and banned-term adherence.

**First-pass quality** (added with s.22) counts two things: compositions whose first technical measurement passed before any repair or edit, and fully approved assets approved at their first version.

## 22. The demonstration (tools/studio-demo.py)

The request asked for a boss-ready demonstration in six steps. `tools/studio-demo.py` runs them on the live worker and writes one page of evidence. Every sentence on the page is what the worker recorded, not a description of what it would do.

1. **A brief with visible campaign knowledge and references.** The workspace's knowledge counts by authority, the campaign's mark policy, the references, and the gaps before anything is spent.
2. **Three genuinely different directions,** each with its medium, and the measured diversity between them.
3. **A selected concept refined without unnecessary regeneration.** Production from the chosen direction, then a refine card applied as a layout version on the same imagery. The page states that the refinement made no image call.
4. **A coordinated campaign set.** The master is adapted for the other channels, with each format re-composed from the master's plan.
5. **A client comment resolved in a new version.** A private, expiring review link; the client's pinned comment; a text edit (no model call); the comment marked as addressed in that version.
6. **Version-specific approval and a clean delivery bundle.** The agency approves copy and design, then the client approves the same version. The export takes only what the client approved, and the bundle (manifest, copy sheet, composed PNG) is downloaded.

**Cases.**
- **HOOF:** MCA's Hands Off Our Fuel campaign, carrying its wordmark.
- **MCA national:** carries the MCA logo.
- **A third, synthetic client:** "Harbourline Ferries - SYNTHETIC DEMO CLIENT", with an invented kit, facts, a flat placeholder logo and a swatch reference, all labelled synthetic. Its kit is written only into an empty namespace or over itself, never over a real client's.

After the cases, the page shows every mark on every composed asset, checked against its case, and the isolation audit for each namespace.

**Spending.** Nothing runs without `--approve-calls`: without it the tool prints the estimate (about five model calls per case) and stops. Images need `--approve-renders`, which defaults to 0. With no images, the demonstration chooses the typographic direction, so all six steps complete with nothing generated, and the page says so. With images approved, renders run up to the cap, each followed by one inspection, and anything beyond the cap is held.

**What the test proves.** `tests/studio-demo-test.mjs` runs the tool against the worker module, with stub models and the real compose tool in Chromium. It checks:
- all six steps for all three cases
- the refinement made no image call
- the bundle holds the client-approved version and its client decision
- every mark is the case's own, and the isolation audit is clean
- no image was generated
- the synthetic kit refuses to overwrite a kit that is not its own

The first run of the test caught a real issue: the synthetic navy logo was unreadable on its navy ground. The validator blocked sharing until it was changed.

**Not shown:** whether the work is good. With stub models, the words and layouts are placeholders. The real demonstration is the same command on the Mac against the deployed worker, with an approved call budget.

## 23. Editing the imagery by area, with preservation measured (build studio-p17)

The request asked to "verify provider support for masks, editing and preservation before implementing", and to disclose and measure where preservation cannot be guaranteed.

**What the provider supports.** Gemini's image models edit by semantic, text-described masking: the area is described in words. There is no pixel mask to send, so nothing guarantees that the rest of the image holds. This comes from Google's own documentation, read through search excerpts (s.16.1), not first-hand.

**What was built.** An area edit is a render job on the current image, of one of three kinds:
- **A marked area.** The rectangle is said in words and in per cent ("the upper right of the image, from 60% to 95% across...").
- **A new background, keeping the subject.**
- **A restyle, keeping the content.**

The prompt asks for everything else to stay as it is and for no text or logos. The current image is attached. The version records the edit, the version it came from and the limit. The words and marks are layers, and an image edit never touches them. An edit with no image or no instruction fails before any call.

**Measured, not promised.** When the edited version arrives, the browser draws it and its source at 160 px. It measures:
- the mean change outside the area
- the mean change inside the area
- the share of pixels outside the area that moved visibly

The worker files a verdict:
- **held:** outside under 2%, and under 3% of pixels moved
- **drifted:** look before approving
- **changed:** compare the versions before using it

It also warns when almost nothing changed inside the area. A background swap or restyle is recorded as measured, since the whole frame is meant to change, and a person judges whether the subject held. The card on the asset links to the side-by-side compare.

**Already in place from earlier phases:**
- **Panel size, opacity and placement, and removing the panel:** concepts and the layout editor (P6-P7, P13)
- **Replacing a mark with another approved variant:** P9's wordmark variants

**Not built:** a dedicated crop and negative-space control. Moving the photograph's focal region in a composition works only through split layouts and the layout editor.

**Proof:**
- `tests/studio-p17-worker.mjs` (5) covers the prompt, the record, the clamp, nothing spent on a bad edit, the verdicts and the baseline rule.
- The P17 browser case covers marking an area by keyboard, one image call, words untouched, the preservation card and the compare.

**Not proven:** how well Gemini actually holds the rest of a real photograph. The stub returns the same image. The first real edits on the Mac will show what the verdicts look like in practice, and the thresholds may need tuning against them.

## 24. Report: implemented, simulated, tested, unverified

This closes the request "Upgrade AXIOM Creative Studio into an agency-grade creative production platform" (builds studio-p10 to studio-p17, on top of P9). Everything is on the branch. Nothing has been deployed, merged or spent.

### Implemented, by the request's own headings

| Request | Where | State |
|---|---|---|
| Preserve the baseline (combos, identity, reference packs, plans, modes, retain, versions, approvals, renderer, inspection, budgets, Create a new design) | every earlier suite re-run each slice | kept, all suites pass |
| One journey, quick and guided routes, searchable free-typed fields, requirement bands | intake routes (P12), brief combos and bands (P8) | built |
| Campaign sets planned as a sequence | `sequence` stage, Sequence view (P12) | built |
| Brand Workspace: provenance, scope, status, history; rules vs observations, preferences, decisions, inferences; reviewed memory; "What the Studio used" | P10 | built |
| HOOF blue, white and black wordmarks as versioned assets; marks never redrawn | variant library and upload (P9-P10); marks are exact image layers | built; **the three HOOF files are not uploaded** (the team's step) |
| Strategy, art direction, copy, design and production review as stages, Opus 5.5 for demanding work | strategy (P12), concepts (P6-P8), copy, layout, inspection (P7-P9); `CREATIVE_MODEL` defaults to `claude-opus-5-5` | built |
| Three directions by default, adjustable budget, visible difference, diversity measured | P12 (1-5, default 3; plan-signature distance) | built |
| Refine, explore, combine, new, keep | P6-P8 (combine = a card's layout with another card's photograph) | built |
| Board, Canvas, Copy, Review views | P13, P11 | built |
| Canvas: select, move, resize, align, group, reorder, lock, hide, undo, redo, compare, typography, safe areas, keyboard | P13 (compare from P2) | built |
| Editing: modify a region, new background, restyle | P17, measured for preservation | built |
| Editing: panel size, opacity, placement, removal; replace a mark with a variant | concepts and editor (P6-P7, P13); variants (P9) | built |
| Editing: crop and negative space | - | **not built** as its own control |
| Recipes without node graphs, dependencies, selective re-runs, durable jobs, estimated vs actual cost | P14 (impact names what is stale and the remedy; a person starts each re-run) | built; re-runs are proposed, not automatic |
| Validation, visual review, human approval of exact versions; "ship" cannot override a blocking fault | P9 | built |
| Client review: comments, pins, private, scoped, revocable, expiring links, audit, isolation | P11 | built |
| Usage by project without leaking | `/studio/usage` (P14), metrics per client (P15) | built |
| Asset rights and consent records; generated imagery never passed off as documentary | - | **not built** beyond the export manifest naming the model per image |
| Metrics: first usable concept time, first-pass quality, revisions, cost per approved asset, constraint adherence, isolation, with baselines first | P15-P16 | built; baselines are the previous window and the old desks |
| Boss-ready six-step demonstration, MCA/HOOF separation, a third client | `tools/studio-demo.py` (P16), synthetic client labelled as such | built |
| Motion and video | - | not attempted, as the request allowed |

### Simulated

- **Every model call in every test** is a stub: Claude's answers and Gemini's images are fixed fixtures. The tests prove the plumbing, the gates and the records, not the quality of the creative.
- **The third client** is invented ("Harbourline Ferries - SYNTHETIC DEMO CLIENT") and labelled wherever it appears.
- **Preservation in tests** compares a stub image with itself, so "held" is the expected answer there.

### Tested (all passing at studio-p17)

- **Worker harnesses:**

  | Harness | Tests |
  |---|---|
  | studio-worker | 15 |
  | p2 | 11 |
  | p3 | 11 |
  | p6 | 8 |
  | p7 | 6 |
  | p8 | 14 |
  | p9 | 15 |
  | p10 | 9 |
  | p11 | 8 |
  | p12 | 5 |
  | p14 | 4 |
  | p15 | 7 |
  | p17 | 5 |

- **Tools:**
  - studio-compose (7)
  - studio-showcase (10)
  - studio-demo (20)
- **Browser, in real Chromium:**
  - the Studio island (24 cases)
  - the client review page (5)
  - the renderer's layout and validation (64)
- The rest of the worker's harnesses (content, narratives, sentiment, sources, overview, social, artwork) still pass. The worker stays pure ASCII.
- The request's hard cases are covered:
  - long copy and overflow
  - delayed fonts and assets
  - failed jobs and upstream failure
  - stale versions and stale review links
  - baked artwork
  - adaptations
  - read and full roles
  - cross-client isolation
  - spend gates

### Unverified

- **Real models.** The sandbox has no egress, so no Claude or Gemini call was made. The quality of directions, copy, imagery, inspections and area edits is unjudged. The way to judge it is to run `tools/studio-demo.py` (with `--approve-calls`, and `--approve-renders` for images) and `tools/studio-showcase.py` on the Mac against the deployed worker.
- **Deployment.** The live worker is still on an older build. `tools/deploy-worker.sh` from the laptop ships studio-p17, and `/engine/status` will then report the build.
- **Fonts.** Tests draw with fallback fonts because Google Fonts is unreachable here. The validator reports fallbacks rather than hiding them.
- **Thresholds.** The preservation thresholds (2% / 6%) and the metric definitions are first settings, to be tuned against real edits and a few weeks of real projects.
- **Research.** Higgsfield and Runway were read only through search excerpts (s.16.1), and are labelled as such.

### Before using it with clients

1. Deploy the worker.
2. Upload the HOOF wordmark variants and the MCA logo through the Brand view, or with `tools/brand-logo.py`.
3. Run the demonstration with a small approved budget.
4. Look at the work.

## 25. What the first live run taught (build studio-p18)

The first live run of `tools/studio-demo.py` (HOOF and the synthetic client, 20 calls approved, no images) completed all six steps for the synthetic client. HOOF stopped at step 5, and both of its faults were real:

1. **The diagram direction planned image boxes it could never fill.** With no image approved, those boxes stay empty sketches, which correctly block delivery. Production and refinement now take `imagery: 'none'`. The planner is told, and the server enforces it: image regions are dropped, a photographic medium becomes typographic, and the ground takes the kit colour.
2. **The re-composed adaptations overflowed** at 1:1 and 16:9. The app already had the repair for this ("Fix layout (no render)"), but the demonstration composed tiles outside the app and only measured them. `tools/studio-compose.mjs --repair` now applies the same bounded repair first. The repair never changes a word and is saved as a layout version.

Both are covered by tests (`studio-p18-worker.mjs`, and the repair cases in `studio-compose-test.mjs`).


## 26. Freeform everywhere (build studio-p19)

Before P19, a plan could compose a tile freely only in first production and in concepts. Everything that came after (the Partner's revisions, adaptation, sequences, the fallback when no plan came back) went back to the house panel. Now every path keeps the composition a plan:

- **Focused edits by layer.** The revise stage gained the kind `layers`. The model sees every layer by its stable id (`stLayerList`) and answers with operations on named layers only (`stApplyLayerOps`).
  - Refused and named: a locked layer, the words of a copy role (words change through a text edit), a mark held by a mandatory placement rule, and removing a role or a mark.
  - The thread records what changed, what was left alone, and that no render was spent.
- **Redesign by plan.** The `design` kind answers with a whole plan.
  - The current photograph is kept unless an image is asked for, and locked layers are carried in place (`stCarryLocked`).
  - A plan that places no words is refused. The older preset spec is accepted only as a labelled fallback.
- **Adaptation from the master as it stands.** `stLayoutToPlan` turns the current layout back into a plan, hand edits included. `stPlanForFormat` rescales type and the mark for the new stage.
- **Sequences.** Each item carries its own plan. An item without one becomes a house layout labelled "not a bespoke design", with the reason.
- **Production.** One bounded REPLAN call asks for a missing plan. Only then is the house layout used, labelled as such on the version and the thread.
- **Mark placement.** `markPlace` (corner or x/y, width) is honoured unless a campaign `markRule {corner, mandatory, note}` holds the mark. The rule wins, and the plan's request is noted.
- **Split copy.** A headline split across layers (`part`) must reproduce the approved words exactly. Otherwise it is collapsed into one block (`stPartsReconcile`), at normalisation and again after any copy edit.
- **Artwork memory.** `stArtMemory` now offers only this campaign's work and work filed without a campaign. Other campaigns' rows are counted and left out, which closes the HOOF / national leak.

Harness: `tests/studio-p19-worker.mjs` (10).

## 27. Layouts from the same photograph and words; the editor's finer controls (build studio-p20)

- **Explore layouts (same image and copy)** is a fourth action beside Refine, Explore variations and Create a new design (concepts mode `layouts`).
  - The imagery and the approved words are bound whatever the request says.
  - `stPlanLayoutsOnly` keeps only the background region (the current image). It sets aside, and names:
    - new image regions;
    - painted lettering (the words stay live layers);
    - text elements whose words the version does not carry.
  - Each option is measured against the current layout as well as against the others. A look-alike is sent back once (REPLAN); the replacement stands or is marked.
  - Every option is "layout only, no render", and applying one appends a layout version with the same image and copy.
  - The model writes the why under `rationale`. The card shows how far each option draws from the current layout.
- **Framing.**
  - `layout.imageFocus` and region `focus` (`{x, y, zoom}`, normalised by `stFocus`) set the focal point and zoom of the cover crop.
  - The renderer draws them identically in preview and export, and they survive adaptation.
  - This is the "crop and negative space" control the P17 report listed as missing.
- **The editor.**
  - The corner resizes the text box and the words rewrap at the same size. A toggle restores scaling the type with the box.
  - Fields for X, Y, width and height on any unlocked layer; line height on text; opacity and fill on shapes.
  - Framing sliders for the photograph or a selected image region.
  - All of these save as one layout version, with no render.
- **Partner thread.** A focused edit shows what changed (layer and fields), what was left as it was, what was refused and why.
- **Fix.** Shape opacity kept one decimal and is now kept to two.

Harnesses: `tests/studio-p20-worker.mjs` (5), the P20 case in `tests/studio-browser.mjs`, and section 9 of `tests/studio-layout-browser.mjs` (framing, line height, box versus type).

## 28. What the models were told, and what they can do (build studio-p21)

- **Reference recipes.** `studio_references.recipe` holds, per component, whether to borrow it or leave it.
  - The components are typography, colour, composition, hierarchy, imagery, image treatment, panels, spacing, mark placement and copy tone.
  - An exclusion beats a borrow.
  - Excluding a component from a brand or approved reference is recorded as a conflict, because the kit's requirement still holds.
  - Set with `POST /studio/reference/recipe` (full role) or the References view.
  - The recipe rides on the reference's line in every prompt ("BORROW ONLY: ... DO NOT TAKE: ...").
  - Concepts name their influences (reference × component). One outside the recipe is marked on the card and in "What the Studio used".
- **Compiled instructions.** Every model call of a job is filed in R2 at `studio/<project>/compiled/<job>.json`, and the record never holds a key. `GET /studio/compiled?job=` (read role) returns it.
  - Language-model calls: the system and user text exactly as sent, the images by name and size, the model asked for and the one that answered, the effort, thinking, and a plain retry.
  - Image calls: the prompt text, the reference images by role, the image configuration (size asked, size used, capped), whether history was replayed, and `masks: false`.
  - The job's progress, the version's `image.meta.compiled` and "What the Studio used" point at it. The latter lists only the jobs that made what the version shows.
- **Capability registry.** `GET /studio/capabilities` (read role) states, per operation (plan, extract, inspect, render, compose), the model, what it takes, and what it cannot do. Among the things it cannot do:
  - pixel masks (area edits are described in words and measured afterwards);
  - guaranteed transparency;
  - editable painted lettering;
  - size control on the 2.5 fallback.

  It also says how each operation is shown to work. No model operation is claimed as verified on real output. The table sits in the Production view.
- **Fix.** The reference colour swatches passed `style` as a string, which crashed the References view for any analysed reference with a palette.

Harnesses: `tests/studio-p21-worker.mjs` (6), the P21 case in `tests/studio-browser.mjs`.

## 29. The inspection as a record a person can weigh; brand gaps as a request (build studio-p22)

- **Scores with reasons.** Each of fidelity, hierarchy, readability, relevance and identity carries the model's reason.
  - A score the model did not give is null ("not scored"). It used to become a quiet 3.
- **Bound to its version.** The inspection records the version id, its number and the composition signature.
  - Readiness now reports an inspection of an earlier version as `stale`, naming the version it saw. It used to report `none`.
  - The card shows:
    - "verdict: ship / fix / redo";
    - "round N of 2";
    - "of vN";
    - "composed tile" or "imagery only";
    - a stale chip when the asset has moved on;
    - each reason under the scores.
  - A ship verdict still approves nothing, and the third look on a corrected line is refused as bounded.
- **Brand gaps as a request for approved material.** `tools/studio-brand-gaps.py --ns <ns> --key` reads `/brand/workspace` for the client and each campaign.
  - It writes what to ask the client for: marks, colour versions, fonts, palette, voice, identity notes, approved designs, the placement rule, and approved facts with sources.
  - Lines that stop a composition are marked NEEDED BEFORE PRODUCTION. Contradictions are marked PLEASE CONFIRM.
  - With `--out` it writes `requests/brand-requests-<ns>.md`. That folder is gitignored.
  - `--analyse --approve-calls N` analyses unanalysed references, at most N model calls. Without a budget it spends nothing and says how many are waiting.

Harnesses: `tests/studio-p22-worker.mjs` (4), `tests/studio-brand-gaps-test.mjs` (10), and the inspection assertions in `tests/studio-browser.mjs`.

### 29a. From the first live render

The first live HOOF render showed two faults:
- the default blue wordmark sat on an orange road at 1.28:1;
- a pale label sat on the sky at 2.15:1.

The variant swap existed, but only inside "Fix layout", and that button was hidden for the worst case (`mark_unreadable`).

Now:
- **The mark.** The asset view swaps an unreadable mark for its best approved variant on its own (`STRender.markVariants`), as a layout version with no render. A locked mark or a locked layout is left alone.
- **The words.** `repair()` makes words readable by colour first, then with a backing plate. The words, their place and their size never change.
  - Unreadable words are always fixed.
  - Merely low-contrast words are fixed only when someone presses Fix, so a deliberate brand colour such as a gold kicker is not changed on its own.

## 30. Report for the professional-platform request (builds studio-p19 to studio-p22)

All work is on `claude/peaceful-gates-g1t4ss`. Nothing in P19 to P22 is deployed or merged, no paid call was made, and nothing was approved on anyone's behalf.

- **The live worker** was last reported at build p17. The frontend on `main` is at p18.
- **The attached twelve-module specification** did not reach this session. The work follows the modules as the request described them.

### Implemented and tested (stub models, real Chromium for the renderer and the page)

| Requirement | Where |
|---|---|
| Recheck brand records, surface gaps, ask for approved information | P10 workspace and readiness; P22 request tool |
| References analysed by an authorised operation, observations with source ids, observed layouts not mandatory | P6/P8 analysis (full role), P10 observations, s.12 purpose semantics; P22 budgeted analysis |
| MCA logo vs HOOF wordmark; colour version chosen by ground; marks never redrawn | P8-P10 policy and variants; marks are exact image layers |
| Campaign scoping of facts, references, preferences, rules; `stArtMemory` leak | P8-P10; P19 closed the art-memory leak |
| Distinct territories with bounded replan; four separate actions | P8 explore, P12 directions; P20 adds Explore layouts as the fourth action |
| Freeform composition throughout production, Partner, variations, sequence, adaptation; no silent house fallback | P19 |
| Partner positioning by stable layer id; mark geometry separate from mandatory identity | P19 |
| Editor: box vs type, position, size, font size, line height, tracking, alignment, spacing, panel opacity, framing; groups, locks, undo, parity | P13, P20 |
| Three layouts from the same photograph and copy, each with a why | P20 |
| Reference recipes and influence; capability registry; compiled instructions per operation; fallbacks disclosed | P21 |
| Validation at delivery size; cheapest repair; layout edits never render | P9, P18 |
| P17 is described-area editing, not masking: labelled, measured, masks not exposed | P17, P21 registry |
| Locks respected; protected areas compared; repair rounds bounded | P9, P17, P19 |
| Brief suggestions with sources; Partner suggestions with changes, keeps, render and cost | P8, P6 |
| Inspection: scores with reasons, verdict, round, composed vs imagery, version binding, stale | P22 |

### Deferred, as the request asked

- The execution, spending and client-access hardening workstream.
- Interface restyling.

### Unverified

- **Real-model output.** No Claude or Gemini call was made from this sandbox for P19 to P22. The quality of the plans, layouts, inspections and reasons is unjudged.
- **The rendered demonstration (items 1 to 7).** It needs:
  - an explicitly approved budget;
  - the worker deployed;
  - `tools/studio-demo.py` / `tools/studio-showcase.py` run from the Mac.
- **Pixel masks.** Not available from the image model this worker calls, so not exposed.

## 31. One workspace: the Studio as a production tool (build studio-p23)

### Diagnosis (before)

Inspected in Chromium at 1440 x 900, 1920 x 1080 and 390 x 844 on a seeded project (screenshots in
`tests/shots/before-*.png`, written by `tests/studio-shots.mjs before`), and traced control by control:

- **No single workflow.** Twelve views sat in one rail list (Brief, Sources, References, Directions, Board,
  Copy deck, Sequence, Production, Brand, Client review, Client context, Jobs) beside the assets. The
  five-step strip above the work was decorative: "review" and "export" both opened the asset view, and
  export was a modal reached from the header.
- **The artwork did not dominate.** At 1440 x 900 the canvas began below the fold; the Partner column was
  always on, half its height spent on an inspection card that was not about the screen in view.
- **Edits could be lost.** The asset view cleared its draft whenever the version changed, so a keystroke
  typed while the previous save was in flight disappeared; two saves in quick succession raced for the
  same revision and the second came back 409. The brief reset to the server copy on every revision
  change (an extraction job proposing fields was enough to wipe unsaved edits), and a 409 on save said
  only "changed".
- **Client switching could show the wrong client.** The library and kit loads had no guard: a slow
  answer for the previous client could land after the switch.
- **Double clicks could spend twice.** Production, directions, concepts and retries used time-stamped
  idempotency keys, so a double click made two jobs.
- **Errors were toasts.** A missing key, an exhausted budget, a provider 503 and a brief gap all
  appeared as a red toast that vanished; nothing said whether work was kept or what to do next.
- **Nothing resumed.** A reload returned to the library; the project, the stage and the asset were gone.
- **Choosing a second direction re-ran production** without saying it would spend.
- **Adaptation clipped stories.** A 1:1 master adapted to 9:16 kept its per-cent geometry, so the CTA
  and the mark landed under Instagram's story interface (bottom 20%) and the adaptation failed
  validation (found by journey 5, fixed in the worker).

### Design direction

One frame, six stages, the work in the middle.

- **Context bar** (sticky): client, All projects, the project, its campaign, the asset and version in
  view; the save state ("Saving...", "All changes saved", "Not saved - retry"); live jobs; whether the
  models are configured (one chip when both are, a red chip naming the missing one otherwise).
- **Navigator** (sticky): Brief, Directions, Produce, Refine, Review, Export. Each step shows its state
  worked out from the project (done, in progress, to do, running, skipped, blocked) and a short note
  ("2 of 3 validated", "1 ready"). Every stage can be opened; a blocked one opens on its reason. Alt+1
  to Alt+6 jump; focus moves to the stage heading.
- **Stage heading**: the stage's purpose, its main action, the blocked reason, and the views inside it as
  tabs (Brief: Brief, Sources, References; Produce: Board, Sequence, Recipes and usage, Jobs; Refine:
  the asset, Copy deck).
- **Left rail**: the assets as thumbnails drawn by the renderer, with approval state, validation flag
  and a spinner while a job runs on one; below, Brand, Client context and Jobs.
- **Workspace**: in Refine the artwork is sized to the visible height and takes the width it needs; the
  validation strip sits under it with the free fixes; preservation, the family strip, art direction and
  area edits follow.
- **Inspector** (Refine): Copy (fields, locks, layout line, checks), Quality (technical validation,
  the art director's scores, verdict and round, human approval kept apart, and the approve buttons),
  Partner (the thread and composer), Versions (history, what the Studio used). Arrow keys move between
  tabs. Elsewhere the inspector is the creative partner, and can be hidden.
- **Review** is one table of every asset's version, validation, copy and design approval with the
  approve buttons, followed by the client review links and comments. **Export** lists what goes in and
  why the rest is left out, prepares the bundle, and lists every file with its pixels against the
  version's stage size.
- **Tokens**: `.st` defines one scale for space, type, radii, surfaces and states on top of the AXIOM
  tokens; focus is a 2px accent ring; `prefers-reduced-motion` stops the spinners.
- **Narrow screens**: one column; the navigator scrolls to the current stage; the assets become a
  sideways strip; the inspector follows the work.

### Wiring matrix (user action -> handler -> route or job -> engine -> saved result -> next state)

| Action | Handler | Route / job | Engine | Saved | Next |
|---|---|---|---|---|---|
| Choose client | `switchClient` | `GET /studio/list`, `/studio/status`, `/brand/kit` (sequence-guarded) | - | `ax_studio_v1.client` | library of that client only |
| Start (empty state / New project) | `Intake` -> `createProject` (guarded) | `POST /studio/project`, `/studio/source`, job `extract` | `stExtractStage` | project, source, ledger | Brief or Directions |
| Edit brief, Save | `BriefView.save` -> `saveBrief` | `POST /studio/project/update` (revision) | `stBriefNorm` | `brief`; draft in `ax_studio_brief_<pid>` until saved | merged on 409 unless the same field changed (clash offered) |
| Explore directions | `direct` (guarded) | job `direct` | `stDirectStage` | `studio_directions` | Directions |
| Choose a direction | `chooseDirection` -> `produce` | `POST /studio/direction/choose`, job `copy` | `stCopyStage` (`inp.direction` or `chosen=1`) | assets, versions, render jobs | Refine on the first new asset; renders pumped |
| Produce now / No imagery | `produce` (guarded) | job `copy` with `size` or `imagery:'none'` | `stCopyStage`, `stPlanNoImagery` | assets; no renders when none | Refine |
| Type in a field | `AssetView.edit` -> `editAsset` -> `flushCopy` (one queue per asset) | `POST /studio/version` (latest revision) | `stVersionChecks` | text version | draft clears per field once the server holds it |
| Measure | `AssetView.measure` -> `fileValidation` | `POST /studio/validation` | `stValidationJudge` | `studio_validations`, export PNG | strip and Quality tab |
| Fix layout | `repairLayout` -> `putLayout` | `POST /studio/version` (layout) | `STRender.repair` (never the words) | layout version | measured again |
| Edit layout | `LayoutEditor` -> `saveLayout` -> `putLayout` | `POST /studio/version` | - | layout version; on 409 re-sent only if the layout did not change elsewhere | - |
| Direct the partner | `directTeam` (guarded) | job `revise` | `stReviseStage` | versions / new assets (adapt) / proposal | adapted asset opened |
| Explore / refine / new design | `propose` (guarded per asset) | job `concepts` | `stConceptsStage` | `concepts` event | cards |
| Apply a card | `applyConcept` (guarded) | `POST /studio/concept/apply` | `stConceptApply`, `stPlanRenders` | layout version, render jobs | pumped |
| Approve / reject | `approve` -> `ReasonDialog` -> `recordDecision` | `POST /studio/approve` | `stStanding` signature | approval of the exact version | Review table, navigator |
| Share for review | `ReviewView.create` | `POST /studio/share` | token hash | `studio_shares` | link shown once |
| Prepare bundle | `doExport` (guarded) | `POST /studio/render/save` per PNG, job `export` | `STRender.toBlob` after fonts and images load | export manifest on the project | download; files listed with pixels |
| Retry a failed job | `retryJob` (guarded; idem `retry:<job>:<n>`) | `POST /studio/job` | the stage | new job | notice "ran on retry" |
| Cancel | `cancelJob` | `POST /studio/job/cancel` | lease | cancelled | notice: an in-flight provider call may still finish and be billed |
| Reload | `loadLib` -> `openProject(place)` | `/studio/get` | - | `ax_studio_v1.byClient[ns]` | same stage and asset; "Resumed" notice |

### States

First use (library explains a project and offers three starts); missing brief details (the check panel
before anything is spent; mandatory gaps block Produce unless acknowledged); missing marks (incomplete
chip, design approval and export wait); loading (busy line under the navigator naming the job, which
continues if the tab closes); queued and running (rail spinner, job chips with attempt n of 3 and
cancel); success (save state, navigator ticks); partial failure (the set is kept; the failed job is a
chip with Retry and a notice with the reason and Retry); timeout and provider down (explained as
"busy or timed out", work kept); missing credentials (context bar chip, disabled actions with the
reason, and a notice that says nothing was spent); unsaved changes (Unsaved changes in the stage head,
Saving... in the context bar, a beforeunload warning); save failure ("Not saved - retry"); restored
session (resume notice; restored brief edits offered to Save or Discard); conflicts (brief: merged or
the clash shown; copy: Keep mine / Take theirs; layout: Apply mine on top); cancelled or superseded work
(the cancel note; inspections of an earlier version marked).

### Evidence (all MOCKED providers; no live model was called)

- `tests/studio-journey-browser.mjs`: 8 of 8 - the eight journeys of the request, including the zip
  unpacked and each PNG's pixels checked against its version's stage (1080 x 1080, 1080 x 1350).
- `tests/studio-p23-worker.mjs`: 2 of 2 - adaptation into a story stays inside its safe area.
- Existing: `studio-browser.mjs` 26 of 26 (updated to the new navigation; one intermittent run of
  seven failed three art-direction cases and did not reproduce), `studio-review-browser.mjs` 5,
  `studio-layout-browser.mjs` 74, every Studio worker harness (P1-P22), compose, showcase, demo and
  brand-gaps tests, and the overview and scope browser harnesses.
- Not proven: live model output, live latency, real fonts on the production page (the harness has no
  webfonts and reports fallback fonts), Safari and Firefox, a screen reader pass.

## 32. Layout variations, imagery remedies and the Art Director (page build p24; worker unchanged at studio-p23)

### What was reported

A HOOF tile, live: the headline and support unreadable (contrast 1.05 and 1.30), a label overflowing by
one pixel (55 against 54), `imagery_missing`, and **Fix layout** answering "Partly fixed" with nothing
visibly better. Two causes:

- **Stale scripts.** GitHub Pages served `studio-render.js` and `studio.js` without a version in the URL,
  so a browser that had cached the pre-p22 renderer kept a `repair()` that could not change a colour. The
  Studio scripts (and `ax-ui.js`, `content.js`) now load as `?v=p24`; bump it with each page release.
- **A blocker no layout can clear.** `imagery_missing` is blocking in production: the composition expects
  a photograph nobody has made. Moving boxes cannot fix that, and the note never said so.

### What changed

- **Fix layout says what is left.** After the repair, every blocking issue that is not a layout matter is
  named with its remedy ("no imagery yet (generate it, or use a solid ground)", "a mark file did not load
  (load the marks again)", "an image region is still a sketch"). "Fixed" never hides a tile that still
  cannot pass, and an unfixable layout points at the variations.
- **Imagery remedies** (`Remedies` under the artwork, when the measurement finds `imagery_missing` or
  `mark_unloaded`): **Generate the imagery (1 render)** from the composition's own art direction (the
  background region's prompt, else the version's visual note), confirmed first with its size; when the
  last render failed, its explained error and **Retry the render (1 render)** instead; **Use a solid
  ground instead (no render)**, which applies the measured type-only arrangement as a layout version; and
  **Load the marks again** for a mark that did not load. Nothing paid runs without a click and a confirm.
- **Layout variations** (`STRender.variants(layout, copy, images, opts)`, free, no model call). Nine
  arrangements of the same words, marks and imagery: band across the foot, band across the top, words in
  a column on the left or the right (44% wide on 16:9, 52% otherwise), a card lower left or upper left, a
  centred statement over a shade, words over a fade from the foot, and type only (no photograph; the
  ground is the campaign colour; `layout.noImagery`). Each is laid out by measurement: the text layers in
  reading order (kicker, label, myth, fact, headline, support, free, caption, CTA) are stacked in the
  recipe's zone inside the format's safe area (the Instagram story interface for 9:16), sized from the
  original within the readable minimum and stepped down by 8% until the stack fits; a one-line label or
  CTA on its own plate keeps its natural width when centred; the marks go to a corner clear of the words
  (the observed corner first); locked layers stay where they are. Every arrangement is then validated at
  the output size and, if anything blocks, repaired with the contrast fix on; the result says whether it
  passes, what still blocks it, and what is pending that no layout can fix (`imagery_missing`,
  `mark_unloaded`, `imagery_sketch`). The words are never changed: the harness compares every displayed
  word. An arrangement identical to the current one is not offered; a locked layout offers none. The
  Refine workspace shows them as cards drawn by the renderer with their state; **Use this layout** saves
  a layout version noted "layout variation: <name> (no render)". The renderer honours `noImagery` in
  `draw` (no placeholder ground) and in `imageryMissing`; the worker's own rule already agrees (no
  background region on a v5 plan, `style: typographic` with no image on a v4 layout), so no worker change
  was needed.
- **The Art Director** (the creative partner, renamed). The inspector tab, the panel, its head and the
  composer name the role. Above the thread, the **latest review** of the asset is pinned: the five scores
  with their reasons, the verdict, which version it judged (and whether that is the current one), the
  round, whether it saw the composed tile, the most serious issue and the correction on offer with
  **Apply**. **Review vN (1 model call)** composes the tile exactly as it exports, files it with its
  measurement, and runs the existing `inspect` stage on that version; a review is advice and approves
  nothing (the panel says so, and the harness checks no approval moved).
- **No silent spending.** The suggestions beside the Art Director used to be fetched automatically for
  every new version of an open asset - and a pause in typing makes a version - so each hand edit could
  spend a model call. They now wait for **Suggest for this version (1 model call)**; the server's cache
  still answers for free when it holds one.

### Evidence

- `tests/studio-layout-browser.mjs` section 11: the worker's house layouts in 1:1, 4:5, 9:16 and 16:9
  with short and long copy, plus the reconstruction of the reported HOOF tile, each with and without a
  photograph: nine distinct arrangements every time, all nine passing (with the app's fonts), the same
  words in every one, no mark on the words, centred chips at their natural width, the type-only
  arrangement needing no imagery, the others saying the imagery is pending when there is none; a locked
  layout offers none and a locked text layer keeps its place (211 checks in the file).
- `tests/studio-journey-browser.mjs` journey 9: a production whose render failed shows the gap, the
  failed render and both remedies; the solid ground becomes a layout version with no model or image call
  and the worker then holds a passing validation; on a photographed tile every offered arrangement
  passes and one becomes a version with the same words and photograph and no call; the Art Director's
  review is one model call on the composed tile of the current version and changes no approval.
- `tests/studio-browser.mjs` (26) updated for the tab name and the on-demand suggestions; every other
  Studio harness passes unchanged.
- Providers are mocked in these harnesses: they prove the page, the renderer and the worker agree, not
  what a live model answers.

## 33. Report: the S-series (builds studio-p25, page r3) - correctness, brand context, two modes, interface, verification

The request was to upgrade the Studio into a reliable, brand-aware production workspace, in this order:
correctness defects first, then brand-context delivery and the two-mode workflow, then the interface, and
never to hide a rendering or data problem behind a redesign. Baseline `17fd0ec` (`2026-10-03.studio-p24-r2`).
Ten commits on `claude/peaceful-gates-g1t4ss`, one per section; nothing deployed, nothing merged to `main`,
no paid generation run, no migration that drops or rewrites data.

### What was built, by section

- **S1, the seven confirmed defects** (`33db5e2`). Invisible words passed (opacity now measured: `invisible`
  under 5%, `faint` under 50%); a transparent plate was read as an opaque ground (plates drawn with their real
  alpha, glyph colour composited before the contrast is read); a later layer covering the words passed
  (occlusion pass; `occluded` at 20%); the repair and the variations moved a rule-held mark (both hold it, the
  words move); Measure again did nothing after a failed filing (the signature is recorded only when the worker
  accepted the evidence); a placement negation ("No logo at bottom left") voted for the corner it denied
  (clauses read, negation honoured); the reference line omitted the words the analysis read. Each has a test
  that fails on the baseline.
- **S2, two creation modes** (`ccccb89`). `creationMode` editable | finished on the brief, chosen at intake and
  shown as a chip; a finished creative is one Gemini bitmap with the exact words, URL and mark files sent "as
  attached", `layout.layers = []`, `layout.baked`, readiness `not_applicable` with a `baked` block that needs an
  inspection reading every word and mark back, `finished_bitmap` 409 on painted-word edits, `regenerate` and
  `derive` to an editable asset (the S2 paragraph of CLAUDE.md).
- **S3, one scene representation** (`0edeb98`). Marks measured by their visible ink (`vx vy vw vh`), rotated
  boxes as their turned bounds, `contrastMin` and `patchy_contrast`, one `safeAreaOf` table read by the rules,
  the repair, the variations, the editor and the worker, `pixels_unmeasured` as a blocking unresolved state.
- **S4, background positioning** (`1a7a5ab`). `coverTransform` documented and shared by preview, export,
  hit-testing and the subject check; Frame by dragging, zoom, centre and reset; `subjects()` as saliency
  evidence with confidence capped at 0.6; `subject_covered` / `subject_cropped` warnings; `frameSuggest`
  offered, never applied.
- **S5, dependable editing and repair** (`408e29c`). Locks hold in every editor command and on the server
  (`locked`, `mark_held` 409 unless `unlock`); dirty distinct from saved; Fix layout answers complete |
  partial | blocked | nothing with before and after, steps, what stands and why, Undo fix, three fixes a
  session and an oscillation stop; Measure again reloads first.
- **S6, client knowledge** (`8d412c3`). `GET /brand/inventory` (usable, stored but never retrieved,
  unanalysed, missing, conflicting, recommendations with actions, examples wanted); placement as one row of
  evidence per reference with basis, confidence, agreement and exceptions, the rule layer above; Teach this
  brand (inspect writes nothing, preview writes nothing, confirm with a reason writes the campaign `markRule`
  as a kit revision); the taught rule stamped on the produced mark layer, so the S5 gates fire from real
  compositions - a gap found and fixed here: `stMarkLayers` had never set `layer.rule`.
- **S7, one context compiler** (`daf5407`). `stCompileContext` for strategy, directions, production, sequence,
  revise, concepts and suggestions, with a manifest of what informed the call (facts by id, banned terms,
  corrections by id, references attached / read / excluded, artwork memory, placement, marks, sections,
  models, and `omitted[]` with reasons) stored on versions and events; "What informed this creative?" in the
  app. The directions and revise stages had seen no identity line before; the Studio kit block is now
  campaign-scoped (other campaigns' facts counted, not sent), the Content Desk unchanged.
- **S8, genuinely different directions and the six actions** (`209ef22`). Directions measured on argument and
  medium with one bounded REPLAN; `GET /studio/actions` states each action's changes, preserves, cost,
  availability and reason before anything runs; the buttons follow it.
- **S9, workflow and interface** (`b481a0a`). Mode, campaign and content type in the context bar;
  issue-to-element highlighting from the Quality tab onto the tile; the Art Director panel says what the model
  saw, what it read against the approved copy, what it did not score, and that it is one read and never an
  approval; an accessibility audit (named controls and images, heading order, live regions, Alt+1..6, Tab)
  across the views, which found and fixed two unlabelled brief fields.
- **S10, verification** (this commit). Build `2026-10-05.studio-p25`, page scripts `?v=r3`;
  `tests/studio-s10-browser.mjs` and this report.

### Evidence

Every harness runs with the providers MOCKED (a stub Claude, a synthetic gradient as the "photograph"): they
prove that the page, the renderer and the worker agree with each other and with the rules, not what a live
model answers. The renderer and the page run in real Chromium.

- The full suite (`node tests/run.mjs all`, backend then browser, sequentially): `check` 18 of 18; the
  backend and browser harnesses are listed below under "Suite figures" as the run reported them.
- New in the S-series: `studio-s1-worker` (5), `studio-quality-browser`, `studio-s2-worker` (8),
  `studio-modes-browser` (4), `studio-scene-browser` (20), `studio-s3-worker` (3), `studio-framing-browser`
  (17), `studio-editor-browser` (6), `studio-s5-worker` (2), `studio-s6-worker` (7), `studio-brand-browser`
  (4), `studio-s7-worker` (5), `studio-s8-worker` (5), `studio-actions-browser` (2), `studio-s9-browser` (5),
  `studio-s10-browser` (3).
- **The pixel read-back** (S10). One HOOF project: the placement rule taught from the reference evidence
  (bottom left, mandatory), production carrying `layer.rule` on the wordmark and `informed` on the version,
  the six actions all available with their costs stated, the inventory at 7 usable items and 0 stored but
  never retrieved. The composed tile (700 x 875, the Instagram 4:5 export) was then read from its pixels, not
  from its layout: each text box cropped, scaled three times, binarised and read with tesseract.js (English
  data on the machine).

  | Role | Approved words | Words read back | Confidence |
  |---|---|---|---|
  | headline | 6 | 6 | 94 |
  | support | 10 | 10 | 95 |
  | CTA | 3 | 3 | 95 |

  The wordmark's box (x 5%, y 89.6%, w 24%, h 6.4% - the rule's corner) carries ink; every text box carries
  ink against the ground. A whole-tile OCR pass read almost nothing ("|B "), which is why the read-back is per
  box - the figures above are what the engine found, and the whole-tile result is reported too.
- Screenshots of the library, brief, Refine, the actions table, the highlighting, the Art Director, the
  editor with the held mark, Review, Export and Brand in `tests/shots/s10-*.png` (ignored by git), the
  figures in `tests/shots/s10-report.json`; its `gaps` array is empty for this run.

### Simulated, unverified, and known limits

- **No live model output was verified.** Every Claude and Gemini answer in the harnesses is a stub. What a
  real model writes, plans or paints under the new prompts (the identity line, the manifest, REPLAN, the
  finished-creative brief) is unmeasured until a live run is approved; `tools/studio-showcase.py` and
  `tools/studio-demo.py` exist for that and spend nothing without `--approve-calls`.
- **The OCR engine is machine-local.** tesseract.js and its English data are installed in the session
  scratchpad (`OCR_DIR`), not as a repository dependency, because the CDN that fetches the language data is
  not reachable from the sandbox and the data should not be vendored. In CI the harness runs the ink check and
  says so in the report; the word-for-word read-back is a local verification step.
- **`tests/studio-browser.mjs` is flaky under concurrency.** The art-direction and P21 cases time out when
  several Chromium harnesses run at once; alone it passes 26/26 every time. `tests/run.mjs` runs the browser
  suites sequentially for this reason; the cause (a shared port range and slow cold starts, not a product
  defect) has not been removed.
- **The artwork-first workspace was not restructured.** S9 kept the Refine order as it stood (composition,
  measurement strip, remedies, variations, family strip, art direction; words, quality, Art Director and
  versions in the inspector) and documented it rather than moving panels, since moving them would have been a
  redesign with no defect behind it.
- **The S10 harness has one fallback it did not exercise this run:** when no measured issue names a layer on
  the produced tile, the highlighting step records that in `gaps` and defers to `studio-s9-browser`. This run
  found an issue to outline.
- **Subject awareness is saliency, not detection** (S4), and says so with a capped confidence.
- **Deployment and merge are not done.** The worker ships from a laptop with `tools/deploy-worker.sh`; GitHub
  Pages serves `main`. Both wait for approval. The page scripts are at `?v=r3`, so a deployed page will not
  keep a stale renderer.

### Suite figures

Recorded from `node tests/run.mjs all` at build studio-p25 (providers MOCKED; backend first, then the browser
harnesses one at a time): **86 of 86 harnesses passed, none failed**, after `check` 18 of 18. Among them the
S-series harnesses: `studio-s1-worker` 5, `studio-quality-browser` 25 checks, `studio-s2-worker` 8,
`studio-modes-browser` 4, `studio-scene-browser` 20, `studio-s3-worker` 3, `studio-framing-browser` 17,
`studio-editor-browser` 6, `studio-s5-worker` 2, `studio-s6-worker` 7, `studio-brand-browser` 4,
`studio-s7-worker` 5, `studio-s8-worker` 5, `studio-actions-browser` 2, `studio-s9-browser` 5,
`studio-s10-browser` 3; `studio-browser` 26 of 26 in this sequential run (the concurrency flakiness noted
above did not appear). The figures are the harnesses' own summary lines; a harness that counts checks rather
than cases (quality, scene, framing) is listed by what it printed.

## 34. Report: S11 - mark readability per pixel, placement constraints, a trustworthy Fix layout and the artwork-first workspace (build studio-p26, page r4)

The brief for this slice named one screenshot and nine sections. This is what was found, what was changed, how it
is proved, and what is not claimed.

### 34.1 Versions and the defect, established before anything was changed

- The reviewed baseline is commit `e112a33`, worker build `2026-10-05.studio-p25`, page `?v=r3`. The deployed worker
  answered that build on `/engine/status` on 5 October (deployed from the laptop; the sandbox cannot reach it). A
  GitHub merge is not a deploy: the build id and the page's release query are the two facts a browser and a worker
  can be checked against, and the S11 build bumps both (`2026-10-06.studio-p26`, `?v=r4`) so a stale renderer cannot
  be mistaken for the new one.
- **The screenshot could not be retrieved.** The sandbox has no route to the live worker, so the asset and version
  behind the screenshot were not read. The tile was reconstructed from the picture as a **labelled synthetic
  fixture**, `HOOF_STRADDLE` in `tests/fixtures/studio-layouts.mjs` (a cream fact panel from 46% to 86% of the
  stage, a dark green footer below it, a small MYTH label at the top of the panel, a filled CTA chip that also
  carries a box emphasis, the URL on the footer, and the white wordmark placed at 81.5% to 90.5% so its upper
  lettering sits on the cream). Nothing of the user's was read, changed or overwritten.
- **Root cause of the false pass.** A mark's contrast was one number: the mark's mean colour against the mean
  luminance of the ground under its whole box. A mark straddling a light panel and a dark footer averages to a
  middling ground and passes (4.6:1 on the reconstruction) while half its lettering has no contrast at all
  (1.19:1 locally). The same number let a 10% straddle pass in silence. Nothing in the rules looked at where each
  stroke actually sat.
- **The wide outline round the CTA** is not in the artwork. Read from the export pixels, the plate is 209 px wide
  inside a 432 px layer box and no stroke of the plate colour is painted beyond it. The box emphasis the layer also
  carries is drawn around the plate (never wider), and the two together are now named `double_styling`. The wide
  dashed rectangle in the screenshot is the layout editor's layer handle (the layer box, drawn when it differs
  from the ink), which Preview mode never shows.
- **The label over the artwork** was the composition tag, absolutely positioned at the top left of the canvas. It
  now sits under the stage.

### 34.2 Pixel-level mark visibility (section 2 of the brief)

`markReadability()` in `docs/studio-render.js` draws three things for each loaded mark at the output size: the
ground below it (the imagery and only the layers under the mark, with their alpha), the mark alone at full alpha
through the same contain/cover, scale, rotation and opacity `draw()` uses, and what later layers paint over it.
Every sampled pixel whose mark alpha is at least half is a stroke; padding is never sampled. Each stroke is
composited with the layer's opacity and compared with the ground pixel behind it; a stroke under a later opaque
layer counts as lost. The result is a distribution: `inkLost` (share under the lost bar), `inkWeak`, `inkLocal`
(the tenth-percentile contrast, so one pixel does not decide), `inkMean`, `inkRun` (the longest run of twelve
bands along either axis in which most strokes are lost), `inkWhere` (the axis whose bands differ most names the
part: upper, lower, left, right, whole), `inkBoundary` (the ground's tenth and ninetieth percentiles differ by at
least 0.35), `inkCovered`. A multicolour mark is read colour by colour by construction (every stroke against its
own ground), and `markStats` counts the colour families so the fact is recorded. Thresholds, documented in the
code: a wordmark is lettering, so a stroke under 2:1 is lost and under 3:1 weak; a graphic symbol survives less
(1.6 and 2.5). The rule: `mark_unreadable` (blocking) at 12% lost or a run of a quarter of the mark's length;
`mark_low_contrast` (warning) from 4% lost, 30% weak or a tenth percentile under the wanted ratio. `contrast` and
`contrastMin` on a mark box are now the mean and the worst local value from this pass, so the older fields read
the new figures.

The worker judges the same way: `stValidationJudge` requires `report.contract === 2` (a report without it is
refused with "reload the page and measure again"), reads the ink fields bounded to [0, 1], and treats a loaded
mark with no `inkLost` and no `inkLocal` as unmeasured (`mark readability` in `unresolved`, which is
`pixels_unmeasured`, blocking in production). The slim report stored with every validation carries the ink
fields, `clearWant`, `ruleBasis` and `ruleMandatory`. **The contract is versioned:** `ST_VALIDATION_CONTRACT = 2`
is part of `stCompSig`, so every validation filed before this build reads as `stale` the moment the worker is
deployed; `studio-s11-worker` proves a row under another signature is stale, refuses approval on it, and passes
again once measured under contract 2.

Evidence (`tests/studio-marks-browser.mjs`, 35 checks, real Chromium, the expected figures computed from the
fixture's geometry, not from the validator): on the reconstruction the measured lost share is 50% against 50% by
geometry (19,314 stroke samples); at seven boundary positions (y 78, 80, 81.5, 83, 84.5, 86.5, 89) the measured
share matches the geometric share within five points (100/100, 73/72, 50/50, 27/28, 0/0, 0/0, 0/0), blocking
wherever 12% or more is lost and silent where every stroke is on the footer; a 10% straddle is a warning, never
silent (the old average passed it at 6.06:1); a black mark over a near-black footer loses its lower part; a
red-and-white mark on a red panel loses exactly its red half (the left part) and blocks; transparent padding that
crosses the boundary with every stroke on the footer reads (lost 0%); a quarter-turned mark's lost share follows
the turned geometry; a half-size mark in the same relative place gives the same share; strokes under a later badge
count as covered and lost, and an `overlaps` exception for that pair removes them from the count.

### 34.3 Placement constraints and the minimal local correction (section 3)

`markConstraints(rule, b, W, H)` in the shared RULES block (byte-identical in the worker) turns a mark layer's rule
into pixel wants: `clearWant` (the rule's `clearSpace` as a share of the mark's visible height, default 0.5),
`minWant` (`minWidth` per cent of the stage, default 6%), `region` in pixels, `ruleMandatory`, `ruleBasis`. The
rules then judge `mark_clear_space` against any words, URL, CTA or other mark (a warning by the house default,
blocking under a mandatory rule, suppressed by an `overlaps` exception for that one pair), `mark_outside_region`,
and `mark_small` by the rule's minimum. On the server `stMarkRuleClean` sanitises a campaign rule (clear space 0 to
3 heights, minimum 2% to 60%, a region inside the stage; a rule needs a corner or a region to exist), `stLayerRule`
stamps it on the mark layers with its `basis` (rule, preferred or inferred; a preferred rule rides on the layer
and does not hold the mark), and Teach this brand accepts the three fields in a placement proposal.

`repair()` corrects a mark that does not read in this order and names each step: (1) another place inside its
permitted region, or a nudge within its own corner's neighbourhood (never a jump to another corner), each
candidate measured per pixel and refused if it collides, leaves the safe area or breaks the clear space; (2) the
approved variant that reads best where the mark now stands (`swapMarks`, an improvement of 0.4 on the ink score
required); (3) when the mark is held by a mandatory corner rule, or no place reads, the editable supporting panel
beneath it is extended to carry it; (4) otherwise the conflict is named for a person. No box, shadow, outline or
recolour is ever added to a mark. `markRegion()` scans the ground under a mark for a flat band (a footer painted
into the bitmap) and returns it with a confidence and a note saying it is pixel evidence, not a known shape;
Properties offers "Move into this band" and nothing applies it by itself. Evidence: the reconstruction's wordmark
is moved 3% down within its corner (same x, same size, same file) and every stroke reads; with a mandatory rule
holding it bottom right the footer is extended from 86% to 80.6% instead; a mark outside a rule's region is named
and inside it nothing is raised; the bitmap footer is found at y 86%, h 14%, confidence 0.9.

### 34.4 A trustworthy Fix layout, and alignment (section 4)

`repair()` returns `outcome` (`complete` only when the complete validation of the result has no blocking issue;
`partial` when it changed the layout and something still blocks; `blocked` when it could change nothing; `nothing`
only when the tile already passed), `counts` before and after, `kinds` of what remains (geometry, readability,
brand, pending, other) and `remaining`. The island (`repairLayout`) reads `outcome`, never the geometry-only `ok`
and never a filtered list that strikes contrast out: "Fixed" is said only for `complete`, "Nothing to fix" only
for `nothing`, and the note names what still blocks and what is not a layout matter (imagery, a mark file,
unmeasured pixels). Reproduced in the marks harness: an off-canvas mark plus a locked unreadable text gives
`partial` with geometry 0 and readability 1 left; a locked unreadable text keeps the outcome off `complete` and
the conflict names the lock; `nothing` is said only when the tile passes. Alignment of one layer in the editor
uses the format's own safe-area insets per edge (`safeAreaOf`: a 9:16 story's top 14%, bottom 20%, sides 6%; a feed
tile's 3%) on the layer's measured ink, and a drag snaps the ink's edges to the same insets (Alt passes);
`studio-s11-browser` aligns a story headline to 14%, 80% and 6%.

### 34.5 The workspace (sections 5 and 6)

In Refine the context bar is one line (client, All projects, project, campaign, mode, content type, the asset with
its version and format; Preview, Review, Export; saved state, jobs, models); the workflow strip is compact and
disappears in Preview. The left panel holds **Layers** (front to back, hide and lock, selection; the editor's
working layout while editing, through a portal) above the assets, collapses to a strip and resizes by a handle
(this browser only). The canvas has a toolbar - Fit, zoom 50% to 200%, actual size, Overlays, Checkerboard,
Preview, Full screen, Edit layout - over a neutral surround; the composition's facts (mode, medium, imagery,
model, resolution, fallback, incomplete marks, failed loads, fallback fonts) sit under the stage, and nothing is
written on the artwork. Preview is the artwork alone. The inspector is contextual: **Properties** (a selected mark:
approved variant, position and size with the aspect locked, clear space, the placement rule with its provenance -
mandatory rule, preferred, observed on approved references, house default - the local readability figures from
the measurement, and the band offered from the pixels; a text: typography and box; an image: framing; nothing
selected: the composition's facts; the editor's own panels render here while editing), Copy, Quality, Art
Director, **Brand** (the campaign's policy, the marks on file with variants, what is on this composition, the
provenance, the way to the Brand workspace), Versions. One status at the top of the strip - **Blocked / Needs
review / Checks passed / Approved** (`qualityState`: the renderer's `qualityOf` plus the worker's record and the
approvals; an incomplete mark blocks; a pass not yet accepted by the worker, an unresolved measurement or an
inconsistent inspection is review) - with the top issue named first, "show on the tile" and its remedy (Fix layout,
Generate the imagery, Load the marks again, Measure again). Technical, the art director's opinion and human
approval stay as three rows beneath it; no score is hard-coded and a ship verdict never approves. The client's
palette primary colours the current stage, the selected asset and the active tab (`--st-client`); the sticky bars
have a faint translucency.

### 34.6 Design quality (section 7)

The reconstruction's own type problems are reported honestly by the same rules - the MYTH label and the URL are
under the 2.4% feed minimum (`small_type` warnings), the CTA carries a plate and an outline (`double_styling`) - so
after the mark is fixed the tile is **Needs review**, not Checks passed. The layout variations place the mark where
it reads: a band or a fade at the foot leaves the mark room on the preferred side, and the mark's corner is chosen
by per-pixel readability among the clear corners (journey 9's band-foot and fade arrangements, which put the mark
over the sky, now put it on the band). Approved wording and facts are never changed by any correction; both
creation modes stand (a finished bitmap gets no live elements composed over it).

### 34.7 Brand knowledge (section 8)

The inventory and Teach this brand workflow (S6) and the context compiler (S7) are unchanged; the rule's new
fields flow through them, and the Properties and Brand tabs show the provenance of what holds a mark. HOOF keeps
its wordmark policy (the client logo is named as "must not appear here" on the Brand tab).

### 34.8 Regression coverage (section 9)

New: `tests/studio-marks-browser.mjs` (35), `tests/studio-s11-worker.mjs` (8), `tests/studio-s11-browser.mjs`
(9, with screenshots `tests/shots/s11-after-*.png` at 1366 x 768 and 1920 x 1080; `tests/studio-shots.mjs
s11-before` and `s11-after` give the same seeded project at 1440, 1920 and 390 before and after). Updated for the
contract and the rule's provenance: `studio-s1-worker`, `studio-s3-worker` (reports state contract 2 and carry the
mark's ink figures), `studio-s6-worker`, `studio-s10-browser` (the layer rule carries `basis: 'rule'`). No test was
weakened; where an expected figure was wrong by geometry (the 10% straddle position, a black mark on a footer that
is 2.35:1 rather than 1.19:1, the URL's measured width in the clear-space case) the fixture was corrected and the
expectation kept.

### 34.9 Limits

- The reconstruction is synthetic: its marks are solid blocks (every pixel ink, with the fixture's darker lower
  band), its photograph a gradient. The real asset was not inspected; on the deployed worker every earlier
  validation now reads stale and must be measured again under contract 2 before any approval stands.
- `markRegion` is colour evidence (a flat band under the mark) with a capped confidence; it is offered, never
  applied, and is not detection of a footer.
- Snapping and alignment act on measured ink, so a layer whose image has not loaded aligns by its box.
- The left panel's width and open state, the overlays and the checkerboard are this browser's.
- `tests/studio-browser.mjs` remains sensitive to concurrency; the figures below are from sequential runs.
- Deployment and merge are not done; the worker ships from a laptop with `tools/deploy-worker.sh`.

### 34.10 Suite figures

`node tests/run.mjs check`: 18 of 18. `node tests/run.mjs all` (providers MOCKED, backend first, then the browser harnesses one
at a time) at the first complete S11 build: **87 of 90 harnesses passed**; the three that failed were then corrected and re-run
one at a time, each passing (`studio-compose-test` 11, `studio-demo-test` 20, `studio-editor-browser` 6). Two of the three were
the same fixture fault: the harnesses used the 4 x 4 photograph placeholder as the client's mark, and a scaled-up 4 x 4 image has
no strokes to read, so the per-pixel rule refused it (true of the fixture, not the product; the marks are now solid blocks,
`pngSolid`). The third was the editor case dragging a layer that the larger Fit size had put below the viewport; Fit now keeps the
whole artwork in view (zoom and full screen are for a closer look). The S11 harnesses: `studio-marks-browser` 35 of 35,
`studio-s11-worker` 8 of 8, `studio-s11-browser` 9 of 9 (no page errors at either size); `studio-layout-browser` 211 of 211,
`studio-scene-browser` 20, `studio-quality-browser` 25, `studio-framing-browser` 17; `studio-browser` 26 of 26 and
`studio-journey-browser` 9 of 9 in sequential runs; the S-series worker harnesses (s1 5, s3 3, s5 2, s6 7, p9 15, p10 9, p8 14,
s2 8) with their reports updated to contract 2. The figures are the harnesses' own summary lines.
