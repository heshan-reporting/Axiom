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

