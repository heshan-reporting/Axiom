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

### 34.11 Renders that landed but were never seen (build studio-p27, page r5)

The report after the S11 deploy, with a screenshot: "i still cannot see Gemini renders" - an Instagram portrait at v11, three
earlier versions labelled `render` ("imagery as directed", "restyle: give me real images", "re-brief: Render the planned
illustration"), and every one of them a flat teal tile.

**Cause.** Two layout states tell the renderer to draw no photograph: `layout.noImagery`, which the type-only "Use a solid ground"
variation sets (the words on the campaign colour, offered when no imagery exists yet), and a `v: 5` plan with no `background`
region (`planNoBg`: the plan's ground is drawn and nothing else). A whole-image render filed its bitmap on `v.image` without
touching the layout, so under either state the image landed, was recorded (the composition facts said "gemini-3-pro-image 2K"),
and stayed behind the ground. The renders were made and paid for; nothing showed them. The repair's panel extension was checked
and ruled out: it grows a panel only to carry the mark and its clear space, bounded to a few per cent.

**Fix.** `stLayoutShowImage(L)` in the worker: when a plain render (not a region, not the finished or hybrid path) lands on a
layout in either state, the version it makes carries the layout reopened for it - `noImagery` lifted, a full-stage `background`
region added ahead of the plan's own with the prompt "keep the current image", `context.imagery` of `none` dropped - with the
words, marks and shapes exactly as they were, and the note says why ("the type-only ground that would have hidden the imagery is
lifted" / "the plan had no background region; one is added so the imagery shows"). A layout already showing its imagery is left
as it is; a region render still touches only its layer. In the island, `hiddenImagery(v)` names the state for versions filed
before this build: the facts under the stage read `IMAGERY HIDDEN: <why>`, a note sits on the stage, and Remedies offers **Show
the imagery (no render)** - a layout version through `showImagery()`, no render spent. The page scripts move to `?v=r5` and the
build to `2026-10-06.studio-p27` so a stale island cannot hide the fix.

**Evidence.** `studio-s11-worker` gained the case (10 of 10): a render on a `noImagery` layout and on a plan without a background
region is shown with the note; a region render leaves the ground alone; a layout already showing its imagery is untouched.
`studio-s11-browser` gained the case (10 of 10): a render version written as the earlier worker filed it (image on the version,
`noImagery` still on the layout) opens with the hidden state named under and on the stage, the canvas pixel at the top-left is the
green ground before and the cream photograph after Show the imagery, the new version is kind `layout` with the flag lifted and the
render count unchanged. Re-run clean: `studio-worker` 15, `studio-s2-worker` 8, `studio-p8-worker` 14, `studio-p17-worker` 5,
`studio-p18-worker` 3, `studio-p19-worker` 10, `studio-s8-worker` 5, `jobs-lifecycle-worker` 10, `studio-browser` 26,
`studio-journey-browser` 9, `check` 18 of 18. Not verified from the sandbox: the user's own asset (no access to the live D1); on
deploy, opening it shows the hidden state and the remedy if the layout is in either state, and the Jobs view names the one failed
job the screenshot showed.

## 35. S12 - everything that runs is visible (build studio-p28, page r6)

The brief, in the user's words: "everything is running silently ... add completion percentage ... everything happening silently
should show in the UI as a progress". A ChatGPT draft had arrived as a helper (`docs/studio-progress.js`) and a stylesheet
(`docs/studio-progress.css`) referenced from the page, with no consumer in the island, no worker support (the shape it read,
`progress.activity`, did not exist), and chrome against the shell rules (glass, 14 px radius, an entrance animation). Reviewed,
kept as the starting point, rewritten.

**What can honestly be shown.** The models give no progress during a call: a percentage for a running image generation would be
invented from the clock, and the draft itself said never to do that. So the worker now reports what it is doing - a phase, a
label, and counts where the work is countable - and the Studio shows that, with the elapsed time against how long the stage has
typically taken here. A share is determinate in two places only: the copy stage's channels ("laying out facebook (2 of 2)") and
the run's finished steps ("3 of 7 steps finished"). A model call shows an indeterminate stripe and the words "no share until it
answers".

**Worker (S12a).** `job.progress(patch, lines)` in `stJobRun` persists `progress.activity` mid-run under the attempt's fence
(throttled to one write per 700 ms unless the phase changes); `log.phase()` for the stages; `stClaude` reports the model call
with the model named; `stRenderJob` reports preparing / generating / filing; the copy stage reports composing per channel and
queueing; `done()` closes the activity with `endedAt` and records the duration (KV `studio_dur_<stage>`, the last 40;
`/studio/status.durations`). **A bug found on the way:** `stJobRun` returned the stage's promise rather than awaiting it inside
its try, so a fence thrown when a job was cancelled under a running provider call escaped to the route as `500 studio_failed:
fenced ...` - a cancel the person had just asked for answered as a server failure. It is awaited now; the cancel answers with
the cancelled job and the attempt files nothing. `studio-progress-worker` 3 of 3 reads the job's row inside the mocked provider
calls to prove the phase is visible while the call is in flight.

**Island (S12b).** `STProgress` (`job`, `run`, `jobsForDisplay`, `typical`) is the model; `WorkspaceActivity` is its consumer,
replacing the chips above the work: summary (beacon, the top job's phase, elapsed and typical, counts, the run's finished
steps), cards per job (stage in plain words, asset, phase text or latest log line, bar determinate only from counts, elapsed,
attempt, slow hint, explained error, Retry / Cancel / log). The island polls `GET /studio/job?id=` every 2.5 s for live jobs and
ticks a clock while anything runs or just finished. The header chip opens the panel. The stylesheet is on the Studio tokens: flat
8 px surfaces, no glass, the beacon and the indeterminate stripe the only motion, both off under reduced motion.
`studio-progress-test` 22 of 22 (Node); `studio-activity-browser` 3 of 3: a nine-second render is visible as "the image model is
making the background image at 1K" with an indeterminate bar and "1 running" in the header, then done at 100; a refused render is
failed with the explanation and Retry, and the run counter reads 1 of 2.

**Flow (S12c).** Every stage head carries "What happens next": what the main action runs, what is paid, what the person will see.
Journey 6 of the journey harness moved to the panel's selectors; the journey harness ran 9 of 9 alone (8 timed out only under
four concurrent browser suites). Not done here, said plainly: the image generation engine itself is unchanged - what changed is
that its work is now visible - and nothing live was verified from the sandbox.

**The strip, tightened (the same screenshot).** The second request on that screenshot was the readiness strip itself: Fix layout
appeared twice (beside the issue and again in the action row); the repair note ran "Blocked (1 blocking before, 1 after; left:
geometry 0, readability 1, brand 0, pending 0). The logo still does not read ... Choose a layout variation, move it by hand, or
revise the ground. Still blocking: mark unreadable (logo). Nothing was saved. Move the words by hand, choose a layout variation, or
shorten the copy." - the issue named three times, zero counts listed, and a closing sentence of advice that did not apply to a
logo; and Properties repeated the medium and the imagery the tag line under the stage already carried. Now: Fix layout is offered
once, beside the top issue (the action row keeps Measure again and Download draft PNG, and shows Fix layout only when the top
issue has another remedy); the note is the outcome first ("Blocked."), a compact count naming only the kinds left ("1 blocking
before and after (1 readability)"), the renderer's verdict as it stands (it already names what blocks and what would clear it),
"Nothing was saved", and the next steps as buttons - Undo fix, Move it by hand (opens the layout editor), Layout variations (N of
M pass, scrolls to them) - with no second sentence of generic advice and no "Still blocking" repeat where the verdict names the
issue; Properties' composition facts give the size, the layer count, hidden and locked layers, and leave the medium and imagery
to the tag line. `studio-s11-browser` 11 of 11: the first case now asserts one Fix layout button; a new case locks the Story's
words so the fix has no colour it may change, runs it, and reads the note (outcome, count without zero kinds, the verdict, no
generic sentence, the issue not repeated), opens the editor from Move it by hand, reads the pass count on the variations button
once they are measured, and finds the imagery stated once in Properties.

### 34.12 Words shown twice, padded marks and thin overlays (the 6 October carousel frame)

The third screenshot (Frame 3: the truckie, v3): the support sentence appeared twice - once as the support, once faintly
beneath it with a dash in front, a free "label" the planner had filled with the same words; the logo sat as 43 px of ink inside
a 184 px box (the file is mostly padding) with the validation reading "passed, 4 to look at"; and the request named "overlay
fixes" that did not work well and "logo contrast issues" across the set.

**Words shown twice.** The shared RULES block gained `duplicate_text` (blocking): two live text layers whose displayed words are
near-equal - punctuation and case aside, the shorter at least seven tenths of the longer and contained in it, twelve characters or
more - are a repeat a reader sees twice, whatever the boxes do (a headline that quotes a phrase of the support is not: 22 of 83
characters). The worker's judge carries each text box's displayed words for it, so the finding holds server-side. The version
never carries the repeat in the first place: `stDupText()` in `stAppendVersion` hides a free layer that repeats the headline, the
support, the CTA or the caption (the copy's own layer stays; the words are not rewritten; the note says "hid echo: the same words
as the support, shown once"), and `repair()` hides one filed before this build.

**The padded mark.** `repair()` enlarges a mark whose visible ink is under the minimum width (`mark_small`, now a finding the fix
acts on) about the ink's corner nearest the stage edge - the box scales, the file is never redrawn or cropped - until the ink
reaches the minimum, and keeps the change only when the complete validation finds nothing new blocking on the mark (a collision,
the safe area, its clear space). `mark_padding` stays a warning that says how the mark is judged; it does not by itself call for
a change.

**The overlay first.** For words that do not read, `repair()` now looks for an editable, unlocked panel, band, footer or gradient
that already sits beneath them and covers them, and makes it denser (alpha or opacity 0.85, then 0.95) before any word is
recoloured or plated: one change serves every word on the overlay and keeps the design's own device; the colour and plate steps
remain for words with nothing beneath them. Not changed: a solid panel at full opacity whose fill is simply too light (no density
to add) still goes to the word's colour, then a plate.

**Evidence.** `studio-marks-browser` section 7 (50 of 50): the repeated sentence is `duplicate_text/blocking:support,echo`, the
repair hides the label and keeps the support, no word is rewritten; a wordmark in a box a third of the minimum grows from 42 to
70 px of ink anchored on its bottom-right ink corner with nothing new blocking; white words over a 25% overlay on the cream
photograph fail, the overlay becomes `rgba(10,14,22,0.85)`, the words keep their colour and get no plate, the headline's
contrast rises past the bar. `studio-s11-worker` (11 of 11): the echo is hidden on the version with the note, two free layers
with the same words are blocked by the worker's re-judging, the hidden echo is judged no more. The straddle, layout, scene and
S11 browser harnesses re-run clean with the new rule in force. Not verified from the sandbox: the user's frames (no access to the
live D1); on the next measurement of each, the repeated label reads as blocking with Fix layout hiding it, and the logo's size
is corrected by the same fix.

## 36. S13 - the guided flow from the reviewed mockup (build studio-p30, page r7)

### 36.1 What was reviewed

An interactive mockup of a guided Creative Studio (`design/mockups/creative-studio-guided/creative-studio-guided-mock.html`
on branch `mockup/creative-studio-guided`, with six visual variants beside it). It is a single static page: six steps
(Brief - Set the foundations, Direction - Choose the idea, Copy - Get the words right, Design - Build the creative,
Review - Check & approve, Export - Prepare delivery), a Canva-like design workspace (a tool dock of Design, Text, Images,
Brand, Layers and Partner; a library panel; the canvas with a page strip of formats; an inspector of Properties and a
creative partner), a copy step with one channel at a time and "Mark this copy ready for design", a review preflight
(Copy, Design, Brand, Accessibility) with a human approval that resets on edits, and an export delivery package. Its
progress ("N of 4 demo checkpoints"), its partner's scores and suggestions, and its preflight results are simulated -
the page says so itself in places ("Simulation only", "SAMPLE"). The mockup files stay out of `docs/` (GitHub Pages
serves only that folder); they were read as data and never served.

### 36.2 What was kept, what was wired, what was not taken

| Mockup | AXIOM now | Source of truth |
|---|---|---|
| Six steps in that order | `STAGES`: Brief, Direction, Copy, Design, Review, Export, each with purpose, sub-label and "What happens next" | the project (`flowOf`) |
| Copy before design | Copy step (`CopyStage`); production lands there; with "Imagery: after the copy is ready" no render is spent until Design | `brief.imageryTiming`, the copy stage's `afterCopy` |
| "Mark this copy ready for design" | the agency's copy approval of that exact version (reason `copy ready`); any word change drops it | `studio_approvals` signatures (`stStanding`) |
| "Final client approval happens in Review" | the client review link in Review (P11), separate from the agency's approvals | `studio_shares`, `studio_review` |
| Copy partner: a shorter headline, "Use this headline" | Shorter headline / Plainer words / Three headline options / a free ask, each one `revise` call; options become a text version | the `alternatives` event |
| Dock: Design, Text, Images, Brand, Layers, Partner | `DesignDock`, each going to the existing tool (variations, Copy tab, art direction, Brand tab, layout editor, Art Director); disabled with the reason | the version's mode, locks and role |
| Editable / AI finished toggle | the creation mode stated; a finished creative offers its free editable copy; an editable one cannot become finished (the words would be painted from an unsettled copy) | `brief.creationMode`, `/studio/derive` |
| Page strip of formats | the family strip directly under the canvas | `studio_assets.family` |
| Generate background | Board: Generate imagery (N), the cost confirmed first; `POST /studio/imagery` | `stImageryQueue` -> `stPlanRenders` |
| Preflight: Copy, Design, Brand, Accessibility | read from the record: copy checks, the stored technical validation (blocking findings and warnings named), mark findings, contrast and type findings, alt text; the Art Director's reading as advice | `stChecks`, `studio_validations`, the inspection event |
| Activity bar with a percentage over checkpoints | not copied: the S12 activity panel shows the worker's phases; a percentage only from counts | `progress.activity` |
| Partner scores 1-5, verdict, "Ship" | not copied: the Art Director's real inspection (scores with reasons, missing scores said, never approval) | the `inspection` event |
| Manrope / DM Sans, glass and gradients | not taken: the shell's flat token styling (`docs/studio-flow.css` on the Studio tokens) | the Phase 5 shell rules |

### 36.3 The parallel ChatGPT branch (`chatgpt/local-work`)

Reviewed line by line before anything was taken. Kept, each with a test that fails on the code before it
(`tests/studio-s13-worker.mjs`): a render that keeps an edit made while the image was generated (the bug was real:
a layout the render had to change - the imagery reopened on a type-only ground - was built from the version read
before the provider call and silently reverted a hand move; region renders merged into the old version too); a worker
with no image storage refusing before the call; the judge treating a type-only ground as expecting no photograph and
keeping a browser's "imagery did not load". Kept in the page: a 15 s image decode timeout, ordered reloads, a composition
never reported ready with the previous version's images, variations that show a photograph on file, and an export that
stops with the asset named rather than downloading a bundle with a hole or a blocked tile. Not kept: its progress model
(fixed milestones counted as a percentage of the work, which S12 had already replaced with phases and counts) and a
variant of the stale guard that would have hidden every render landing after an edit as a branch - the same "I cannot
see the render" failure the p27 fix removed.

### 36.4 Verified, and not

Verified in the sandbox with every provider mocked: `studio-s13-worker` (7 of 7), `studio-guided-browser` (6 of 6,
Chromium: the six steps, imagery after the copy with no image call, a copy edit as a text version, ready for design as
the copy approval and its falling away on an edit, the partner's three options and the chosen one applied, the dock
reaching each tool, Generate imagery as one confirmed call landing on the composition, the preflight read from the
measurement with a warning named rather than passed, a missing alt text named, a read-only key), and the studio (26),
journey (9), modes (4), S9 accessibility (5, now auditing the Copy step), S10 (3), S11 (11), activity (3) and actions (2)
browser harnesses on the new steps. Not verified: anything a live model answers, and the deployed worker (the Mac's
`tools/deploy-worker.sh` ships build `studio-p30`; until then `POST /studio/imagery` is an unknown route and production ignores
the imagery timing, while the page's Copy step and preflight work against p29).

## 37. S14 - the product skin from the mockup (page r8)

Asked for: "The UI must be exactly same as this or even better ... like it was designed by a senior UI designer ... advanced
CSS and animations ... development grade." The mockup's design system was read from its stylesheet (palette, type, radii,
spacing) and rendered step by step in Chromium to compare against; the Studio's own markup was then given that language
rather than rebuilt, so every wired behaviour (jobs, versions, measurement, approvals, the activity panel) is untouched.

- **One palette, one place.** `docs/studio-skin.css` defines the mockup palette as `--sk-*` and remaps the Studio's tokens and
  the app tokens its older rules read onto it, inside `#studio-root` only. Fonts: Manrope (display), DM Sans (text).
- **Structure from the mockup:** framed workspace; header with brand mark, project title over campaign / mode / content
  chips, client select; six numbered steps with sub-labels and live notes; editorial stage headlines with an eyebrow; a
  segmented sub-navigation; a Canva-like desk (vertical dock, canvas on a dotted ground with a deep artboard shadow, canvas
  bar, page strip, inspector tabs with an accent underline); copy list with format icons and state pills; direction cards
  with art tiles; preflight rows with thumbnails.
- **Better than the mockup, where the mockup was a picture:** every number on screen is the worker's; the step notes are
  live; the direction tiles are honest text previews; motion is tied to state (arrival, progress, completion, attention) and
  switched off under reduced motion; touch targets reach 44px on coarse pointers; the layout reflows at 1180, 900 and 640px.
- **Not copied:** the mockup's simulated percentages, sample scores, the lucide CDN (icons are drawn inline), its footer.

## 38. S15 - the Creative Studio tab, Back, and the brief engine (build studio-p31, page r9)

Asked for: a Creative Studio tab of its own; the browser's Back to go to the previous page, not to Google; an engine that
understands a written brief, an upload or a news article, analyses it and comes up with the next stage; today's brief pasted
in to be filtered for the client, run against its knowledge and campaigns, then copy and visual narratives - each for an
editable layout or a finished Gemini creative.

- **Tab and history.** A Create group with the Creative Studio tab. Each view is a history entry (`#v=<view>`); the Studio
  pushes its project and stage, so Back walks back through stages, to the library, to the view before the Studio.
- **The process, in order.** (1) The material becomes a source. (2) One model call reads it paragraph by paragraph against
  the client's compiled context (campaigns, approved facts, banned terms, voice, corrections, Mind passages). (3) The answer
  is normalised against what is real: paragraph ids that exist, a campaign the kit has, fact and knowledge ids that were
  given; a paragraph is never both kept and set aside; one not placed is named. (4) The proposal fills only empty brief
  fields and says so; the narratives become directions with their route; the kept paragraphs become the source's focus and
  ledger. (5) The next step is named, with the button for it. Nothing is produced until a person chooses.
- **Filtering holds downstream.** The copy stage reads the analysis (clean angles; claims that conflict with a fact listed as
  not to use; unverified ones to attribute or leave out) and only the kept paragraphs: in the harness, nothing from the gas
  and housing paragraphs of a multi-client daily brief reaches the writer.
- **Routes.** An editable narrative produces live layers over generated imagery; a finished one sets the project to
  Finished creative before production (every S2 safeguard - marks attached as files, words read back - applies).
- **Limits, stated.** The analysis is one model's reading: a kept paragraph can be wrong and the table shows every decision
  with its reason. Uploads are text (.txt, .md, .html); PDFs and Word files go through `tools/engine-ingest.py` or are
  pasted. The first 80 paragraphs are read; later ones are listed as not placed.

## 39. S16 - the Brief Intelligence and Creative Response Engine (build studio-p32, page r10)

Asked for: an engine that understands any input - a written brief, today's brief, a situation, breaking news, a competitor
or political statement, an article, a social post, a screenshot, documents, a URL, and what Axiom already knows - converts
it into a strategic brief, and never jumps from raw material to copy; with situation intelligence (what happened, why it
matters to this client, should they respond), generated and ranked objectives, key messages, topic and issue relevance,
brief cleaning, relevance-based retrieval, a comparison with existing knowledge, response strategies including not
responding, genuinely different creative directions with visual narratives, two production modes, multi-version
production, an Understanding panel before generation, a learning loop, and traceability from source to output.

The pipeline as built: **input** (paste, link, file or screenshot, From Axiom) -> **understand** (input type, every brief
field with its basis) -> **situation** (what, why it matters to this client, respond yes / no / monitor) -> **clean**
(paragraphs kept or set aside with a class) -> **retrieve** (Mind, live narratives, alerts, decisions, earlier choices,
sentiment, facts - by relevance, each with an id) -> **topics and issues** (high / potential / not) -> **compare**
(new, known, supporting, contradicting, gaps, a Creative Intelligence Summary) -> **objectives** (ranked) -> **key
messages** -> **response strategy** (one recommended) -> **directions** (approach, visual narrative, route) -> the team
chooses -> **production** (copy and layouts, or a finished painting, or several narratives as variants; the message kit for
the words that are not tiles) -> approval -> learning (every choice, rejection, edit and verdict logged and read by the
next analysis for the client).

Traceability: every direction carries `trace {source, kept paragraphs, evidence, objective, message, strategy}`; every
version produced from it carries the same in `context.trace` with the direction; every kit piece carries it with its own
checked evidence ids. The page shows it as a **Traceable to** line.

Limits, stated. The reading is one model's: the panel shows every decision with its basis and the kept / set-aside table so
a person can disagree, and nothing is produced until a person chooses. Performance data (CTR, conversions, engagement) is
not yet read into the comparison - the archive holds campaign rows per client but their fields differ by platform; it is
the next slice. Video scripts and motion ideas are text: no video is produced. A paywalled page that the full-text reader
cannot reach is refused with the attempts, never guessed. Uploads are images and PDFs up to 8 MB; Word files are pasted or
go through `tools/engine-ingest.py`.

## 40. S17 - one creative operating system: the guided workflow and the canvas editor (build studio-p33, page r11)

Asked for: the whole Creative Studio reviewed as a production product before launch and made into one structured creative
operating system - a strict progressive workflow with real gating (Brief, Objectives, Strategy, Directions, Copy, Design,
Review), a project wizard, a brief workspace that takes mixed input, a processing view that says what is happening, Axiom's
understanding reviewed before anything is built on it; dependency prompts ("Update Directions / Keep Existing Directions")
so nothing is silently regenerated or destroyed, and no automatic navigation; a rich Directions board; a professional canvas
editor (inline text, a contextual toolbar, fonts, snapping, layers, effects, image adjustments and AI image operations,
shapes and icons, style variations, an AI Creative Director, handles and rotation and marquee, undo and redo, autosave, zoom
and pan, responsive resize, a Creative Quality summary with Fix automatically); meaningful loading states with no invented
percentages; errors that offer Retry, Change input and Continue manually; keyboard shortcuts.

### 40.1 The workflow, held on both sides

A project made in the wizard carries `brief.workflow = 2`. `stWorkflow(p)` works out every step's state from the record -
not started, in progress, processing, needs review, complete, skipped, locked (with the sentence that says what opens it) or
error - and the island and the server read the same answer: the navigator draws it, `stWfGate` refuses a job or a choice
that would skip a step (409 `workflow_locked` with the need), so a stale tab or a direct API call cannot skip ahead either.
What each step needs:

| Step | Opens when | What a person does |
|---|---|---|
| Brief | always | adds the material (text, links, files and screenshots, notes, Axiom items - several at once, read as one), Axiom analyses it, a person reviews the understanding; a campaign change afterwards sends it back for review |
| Objectives | the understanding is reviewed | chooses and confirms an objective, a key message and the topics in play |
| Strategy | the objective is confirmed | confirms a response strategy (Axiom's recommendation marked) and the campaign, or records not responding with a reason |
| Directions | the strategy is confirmed | generates, refines, merges, makes alternatives, saves, sets aside, duplicates, compares, and chooses one |
| Copy | a current direction is chosen | writes the words and the visual narrative per channel (one call, no image) and marks each piece ready for design |
| Design | a piece is ready, or anything was produced | chooses the production mode per ready piece, then works on the canvas |
| Review | a validated piece with ready copy (a finished creative: words and mark read back) | the preflight, the approvals, the client review; Export is a tab here |

Projects made before the guided workflow keep their free order (the old steps report "not used in this project").

**Changing an earlier choice.** A confirm that would leave directions or pieces built on the earlier choice is refused once
with 409 `affects_downstream` and the impact (directions, whether one is chosen, pieces, approvals). The island asks:
**Update directions** (the work stays, marked as built on the earlier choice, and new directions are built on the new one),
**Keep existing directions** (the work stays current under the new choice; nothing is regenerated) or **Cancel** (nothing
written). Copy written on an earlier choice is said once, with Rewrite or Keep, and Keep is per piece
(`brief.intel.keptItems`): the piece named is current again, its neighbours on the same basis are not. Nothing is deleted
anywhere in this path.

**No automatic navigation.** Generation finishes where the person left it: a ready card or a notice with a button ("View
directions", "Open the editable copy"), never a jump. Back walks the history the Studio pushes (S15).

### 40.2 The Directions board and copy before imagery

Each direction card carries the approach, the core idea, the hook, three headlines, the visual narrative, the route and a
**free preview** drawn by the renderer from the direction's plan (no image call). Directions carry the basis they were built
on (`basis {intel, objective, message, strategy}`) and the copy carries it forward on every version (`context.basis`), so
"built on an earlier choice" is a fact read from the record, not a guess. The copy step renders nothing; imagery waits for the
words to be marked ready, because a render spent on words that will change is money spent twice. Then, in Design,
`POST /studio/production {mode editable|finished}` (`stProduction`) goes piece by piece: editable queues the imagery each
composition plans; finished appends a finished version and queues its one painting with the mark files attached; a piece
whose copy is not ready, a copy-only piece, a finished piece asked to be editable, or a locked layout is named with its
reason and the rest go. A finished request with no mark on file fails before any spend.

### 40.3 The canvas editor

`LayoutEditor` (in `docs/studio.js`) with its parts in `docs/studio-editor.js`, drawing through the one renderer:

- **Selection and gestures.** Eight handles (an edge resizes from that edge, in the layer's own frame so a turned layer
  resizes along its own sides; Shift keeps proportions, Alt from the centre; a mark always keeps its proportions), a rotation
  handle (Shift for 15 degree steps; it settles on the square angles within 3), a marquee from the empty stage (Shift adds),
  and snapping of the measured ink - its edges and centre - to the stage edges and centre, the format's safe area, a 10% grid
  when shown and the other layers' edges and centres within 0.8% of the stage (Alt passes), with the guide drawn while the
  gesture lasts. Gestures run on the display's frames; each is one undo step.
- **Words.** Double-click or Enter edits the words where they sit, set in the layer's face, size and colour; a copy role
  writes the approved copy field and saves with the layout as one version; a locked field or a part of a split headline is
  not opened. Each text layer names its words to a screen reader.
- **The floating toolbar** over the selection: font, size, bold, italic, alignment, colour and edit the words for text; fill
  and opacity for a shape; flip, fit and replace for an image; duplicate, lock, order, delete and more for every layer.
- **Fonts.** The picker groups the brand faces, recommended faces and recent ones over a 40-family Google Fonts catalogue,
  with search and preview on hover. A brand-kit font name outside the catalogue is never sent to Google; a face that does not
  load is reported by the validation, never silently replaced.
- **Effects and image treatment.** Drop shadow, outline, glow, blend modes, blur, opacity; brightness, contrast, saturation,
  warmth, tint, sharpness, flip, circle mask, corner radius - drawn by the renderer in the layer's own box, never on a mark.
- **Adding.** Heading, body text, a label; rectangle, pill, circle, triangle, line; an icon from the catalogue; an image from a
  file (`POST /studio/image/upload`, checked by its bytes, kept in the project's uploads).
- **Layers.** Ctrl+D duplicates, Delete removes (a copy-role layer is hidden, so the approved words are never lost; a mark is
  never duplicated or deleted), Ctrl+C and Ctrl+V copy and paste (an image from another project is not carried), Ctrl+G
  groups, Ctrl+] and Ctrl+[ reorder; the Layers panel orders by dragging, hides, locks, duplicates and deletes.
- **Autosave.** An unsaved layout is a draft for this person only (D1 `studio_drafts`, one per person per asset, naming the
  version it was made on) and is offered back after a reload; it never becomes a version by itself.
- **Zoom and pan.** Fit, 50 to 200% and actual size in the control; Shift+1 fits, Shift+0 is actual size, Shift+2 is 200%;
  Ctrl or Cmd with the wheel zooms from 25 to 400%; Space and drag pans.
- **Style variations.** Ten named treatments of the same words, marks and imagery - Minimal, Bold, Editorial, Data-led,
  Social-first, Corporate, Premium, High-impact, Clean, Campaign-style - each measured (and repaired) at the output size;
  "Use this style" is a layout version with no model call.
- **Resize to other formats.** Eight platform presets (Meta square and portrait, Story or reel, LinkedIn link and square, X
  landscape, Display, YouTube thumbnail): one new asset per format in the same family from the composition as it stands -
  words, styling, placed images and photograph - with no model call and no render; a painted bitmap is refused with the way
  forward (make an editable copy first).
- **The Creative quality summary.** Readability, Layout, Imagery, Brand, Accessibility and Platform fit (and Other findings,
  so no finding is dropped) rated Good, Fair or Poor from the renderer's measurement and the copy checks - never a model's
  opinion. **Fix automatically** is the bounded repair (it never changes a word) and is offered only when a blocking finding
  is a layout matter; what no layout move can fix (no imagery yet, a mark that did not load, pixels that could not be read) is
  named with its remedy.
- **The Art Director on the selection.** With layers selected the composer names them and the revise job carries them, so a
  direction like "make it bolder" is aimed where the person pointed.
- **AI image operations** stay edits by description (Gemini's semantic masking): change a marked area, remove an object (the
  marked area is enough), a new background keeping the subject, change the light (the words of the change), restyle keeping
  the content; each states its cost before it runs and is measured for preservation afterwards.

### 40.4 Loading, errors, keyboard

The processing card names the step a job is on from its live activity (S12) and counts only what is countable; a model call
shows elapsed time and the typical duration, never a share. A failure says what failed, that nothing made before was
touched, and offers Retry, Change input and Continue manually. Cancel says that a call already sent may still finish and be
billed. Alt+1..7 move between the steps; the canvas shortcuts work wherever the focus is not in a field, including after the
focused layer has left the canvas. **?** or the Shortcuts button opens the sheet of every shortcut (Selection, Layers, Words,
Gestures, History, View, Studio), written from the same list the editor answers to, naming Cmd on a Mac and Ctrl elsewhere;
while it is open the canvas takes no key.

### 40.5 What the ported suites found

Moving every browser suite onto the wizard and the seven gated steps (`tests/studio-flow.mjs` holds the shared steps) found
defects that are fixed in this release, each now covered: the renderer fetched any brand-kit font name from Google Fonts;
Design locked itself after production when a word changed, taking the canvas away from work already on it; the header named
the old intake's creation mode on guided projects; analysis was offered without a model key; the empty library promised a
start "straight to production"; the Layers panel squeezed a layer's name to nothing beside its order controls; Review's lock
spoke of validation for a painted bitmap; a new job did not appear until the next refresh, so the processing card was never
seen while the job ran; after Delete hid the focused layer the keyboard fell to the page and Ctrl+Z no longer reached the
editor; a text layer did not say its words to assistive technology; Ctrl+Shift+] and Ctrl+Shift+[ (to the front, to the
back) never fired, because with Shift held the key arrives as a brace; and Alt+1..7 never moved between steps on a Mac, where
Option with a digit types a symbol (both are now read by the key's code). The floating toolbar sits over the layer above a
selection, so the older suites now reach a covered layer through the Layers list, as a designer would.

### 40.6 Limits, stated

- Every model step in this release (analysis, objectives, strategy, directions, copy, the Art Director) ran against mocked
  providers in the harnesses. No live model output was judged here.
- Image operations are by description, never a pixel mask; there is no upscaling and no cut-out to transparency in the
  editor. A removal or relight can change more than asked: the preservation measure says how much, and a person decides.
- Handles appear for one layer at a time; a multi-selection moves, aligns, distributes, groups and reorders but is not scaled
  as one. A turned layer snaps by its box rather than its ink.
- Fonts come from Google Fonts at run time; the sandbox has no network, so the harnesses prove that a face that fails is
  reported, and real loading is seen only on the live page.
- A draft is one per person per asset: two tabs of the same person on one asset keep the later autosave.
- Projects made before the guided workflow are not moved into it; they keep their free order.

### 40.7 Suite figures

`npm test` on the final code: **108 of 108** - the 21 checks (worker syntax and ASCII, the RULES block byte-identical in
worker and renderer, every page script parses, nothing private in `docs/`), 53 backend harnesses and 34 browser harnesses,
1,064 cases in all, every provider mocked and nothing spent. S17's own: `studio-s17-worker.mjs` 13, `studio-s17-editor-worker.mjs`
8, `studio-s17-render-browser.mjs` 28, `studio-s17-browser.mjs` 8, `studio-s17-editor-browser.mjs` 12. The suites moved onto
the wizard and the seven steps: `studio-browser` 26, `studio-journey` 9, `studio-guided` 6, `studio-modes` 4, `studio-brand` 4,
`studio-s9` 5, `studio-s10` 3, `studio-s11` 11, `studio-s15` 4, `studio-s16` 4, `studio-layout` 211, `studio-editor` 6. The new
keyboard case was run against the old key handling first and failed on each half (the bracket with Shift, Option with a
digit), as a new defect's test must.

## 41. S18 - the focused studio (build studio-p34, page r12)

### 41.1 The baseline, before anything was changed (S17, build studio-p33, commit 54ac0cc)

Measured with `tests/studio-s18-shots.mjs before` (one guided project parked at each step, mocked providers) and the
reference mockup `creative-studio-guided-mock.html` (dock 54 px | library 166 px | canvas | inspector 255 px under one header
and one navigator, everything inside the window). Concrete failures, each seen in the captures:

1. **Three shells stacked.** Inside the Studio the AXIOM masthead, the full news navigation (two rows), the scope bar and its
   note take 225 px at 1440 x 900 before the Studio's own header (another 70-95 px), its navigator (65 px) and the stage
   head. A third of the window is chrome that has nothing to do with the work.
2. **The artwork is not in the window.** At 1440 x 900 the Design artboard occupies y 679-1139; at 1920 x 1080 y 621-1261.
   Nowhere does it fit by default.
3. **The Creative Director's composer is a page away.** y 1348 at 1440 x 900, y 1238 at 1920 x 1080: under an explanatory
   paragraph, the review card and the whole project thread.
4. **Four names for one assistant.** Partner (dock), Art Director (tab, panel head, thread), creative partner (stage note),
   Creative Director (nowhere).
5. **Duplicated controls.** Edit layout twice on the asset bar, Review / Export both in the header and as a stage, Fix layout
   beside the top issue and in the Quality tab, the inspection's correction twice (review card and thread).
6. **Conversation mixed with logs.** "Job queued: analyse", "Source added", "workflow" events sit between the team's
   directions and the answers, on every step.
7. **Editing hides behind a mode.** The canvas shows the artwork; selecting a layer needs "Edit layout" first, and the editor's
   panels then appear in other places (Properties tab, left panel).
8. **Every stage repeats itself.** Eyebrow, headline, purpose paragraph, a "What happens next" box and a status strip before
   the first input; the brief step's composer starts below y 760.
9. **Export is a hidden sub-tab** of Review ("Preflight and approvals | Export") with no summary of what the package holds.
10. **Save state contradicts itself.** "Saved" in the header beside "Unsaved layout" in the editor, no distinction between a
    draft, a pending save and a version.
11. **The client accent never reached the interface**: `studio.js` set `--st-client`, `studio-skin.css` read
    `--st-client-accent`; every client was cyan.
12. **Narrow screens**: at 390 px the scope bar fills the first screen and the step navigator scrolls sideways over the work;
    the assistant is thousands of pixels down.

Five reported defects reproduced first in `tests/studio-s18-browser.mjs` (all five failed on the baseline): the composer
cleared before the request succeeded; Enter submitted past the Send button's checks (and cleared the words while a request
was in flight); the composer outside the window; the accent variable mismatch; the correction shown twice.


### 41.2 What changed in the structure

- **One frame, owned by one stylesheet.** `docs/studio-shell.css` is now the only place the Studio's frame is laid out
  (header, navigator, body grid, the Design workspace, the inspector, the drawers). The frame rules that had accumulated in
  `studio-skin.css` (155 lines), `studio-guided.css`, `studio-flow.css` and the Studio block of `index.html` (70 lines) were
  removed rather than overridden; the skin keeps colour and type only. `go()` in `index.html` sets `body.in-studio` while the
  Studio is open, and only then are the AXIOM masthead, the news navigation and the scope bar folded away. Every other AXIOM
  view is untouched; **Back to AXIOM** in the Studio header returns to the front page (asking first over an unsaved layout).
- **One header.** Back to AXIOM, the Studio's name, the project (title; client, campaign, content type and creation mode on
  one line beneath), then the save state, the jobs, whether the models are configured and a help button. In the library the
  header carries the client select and the build.
- **Stage heads that answer the five questions.** Eyebrow, one headline, one sentence of purpose, and two facts - *Needs*
  (what this step requires; when it is blocked, what blocks it) and *Main action* (what the primary button does and whether it
  spends a model call or a render). "What happens next" folds behind the step's help button. Review is now **Review &
  Delivery** with Delivery as its own tab: what is in the package, what is left out and why, and one button that names the
  count.
- **Design is a workspace, not a page.** Tool dock (Design, Text, Images, Brand, Layers) | a contextual library that opens
  beside the canvas for the tool chosen and closes again | the artboard | the inspector. The artboard is fitted to the space it
  has with container queries (`cqw`/`cqh`), so it is in the window at every size; zoom, Fit, guides, checkerboard, Preview and
  full screen sit in one bar above it, the page strip of the family under it. **The canvas is the editor**: there is no "Edit
  layout" mode; a layer is selected on the artboard directly, with every S17 capability (handles, rotation, snapping, marquee,
  inline text, undo, drafts, framing) and the editor's panels shown in Properties. A finished bitmap or a locked layout shows
  the artwork without handles. Guides and outlines draw only on hover and selection, never in Preview or the export.
- **The save state is one vocabulary.** *Unsaved changes* (the canvas differs from the version), *Saving...*, *Draft saved*
  (kept for this person only, offered back after a reload), *Version saved*, *Not saved* (a failure, with a retry) - in the
  header and on the canvas foot, never contradicting each other.
- **The theme contract.** `studioTheme(kit, campaign)` picks the accent from the campaign (`accent`, a new optional field in
  the kit's campaigns), else the client's palette primary, else the neutral Studio accent, and computes an ink that reads on it
  (`--st-client-accent`, `--st-client-ink`). It colours the interface only: selection, the current step, the primary button.
  The artboard's surround stays neutral and nothing recolours the creative. Tested with MCA (teal), HOOF (its campaign accent)
  and a client with no kit (neutral).

### 41.3 The right panel

Two modes and two controls, in one tab row: **Properties** (the selection: a text layer's type and box, a mark's variant,
placement rule and readability, the photograph's framing, or the composition's facts when nothing is selected) and
**Creative Director**; **Checks** (the quality summary, the measurement, the readiness strip, and the human approval of the
version, kept apart) and **History** (the versions and what the Studio used). Brand moved into the Brand tool of the dock.
"Partner", "Art Director" and "creative partner" are all **Creative Director** now, in the island, the progress panel and the
worker's own messages.

The Creative Director has three views and one scroll region with the composer anchored under it:

- **Review** - the one current review of the asset: the version it judged and whether that is still the current one
  (*outdated: judged vN* when not, and the correction then asks before applying), what the model saw (the composed tile or the
  imagery only), the round, the top issue first, each score with its reason, what it did not score, the words it read, the
  verdict, and the correction - editable, applied once. "Ship" is stated as an opinion; approval stays with a person in Review
  & Delivery. **Review vN (1 model call)** asks for a new one.
- **Ideas** - the suggestions for this version, each with what changes, what stays, its basis and its cost; *use as
  instruction* fills the composer, *apply* runs it (one model call, confirmed). New directions link to the Images and Design
  tools rather than repeating their controls.
- **Conversation** - the team's instructions and the answers about this asset by default, or the whole project; the scope is
  named above it. The Studio's own log (jobs queued, sources added, workflow events, render chips) is folded into a separate
  "Studio log", so the conversation reads as one.

Below 1180 px the inspector and the library are drawers (Escape closes them); at phone width the step navigator, the stage
head and the canvas stack, and the inspector opens over the work.

### 41.4 The five reported defects, fixed and tested (`tests/studio-s18-browser.mjs`)

1. **Send cleared the words before success.** `directTeam` now answers whether the worker accepted the job; the composer keeps
   the text until then, and a refusal gives it back with the reason, Retry and Edit.
2. **Enter bypassed the checks.** Enter goes through the same `why()` as the Send button: not while a request is in flight
   (the words stay), not during an IME composition (`isComposing`, the composition events and keyCode 229 are all read), not
   empty, never twice (a once-key guards the request).
3. **The composer was outside the window.** At 1440 x 900 the composer, the artboard and the step navigator are all inside
   the window without scrolling the page; also asserted at 1920 x 1080, 1024 x 768 (drawer) and 390 x 844 (drawer).
4. **The accent never reached the interface.** One token name from end to end, a readable ink, and the artwork untouched;
   asserted for two clients and for the neutral fallback.
5. **The correction appeared twice.** One current review holds it; the conversation no longer repeats the inspection's
   controls; one `textarea[id^=fix-]` on the page.

The investigations, each now a test in the same file: switching assets while an instruction is in flight (it goes to the
asset it was written about, and the composer then names the new one); a review of an earlier version marked outdated once the
words change; the conversation following new messages only while the reader is at its foot; a double click on Apply sending one
request; the save state moving through unsaved, draft and version; a read-only key seeing the canvas without handles, composer,
save line or review controls. The canvas editor is keyed by the version, so a selection never survives onto another version; a
failed save says *Not saved* with a retry, and the words stay on the page.

### 41.5 Activity

Unchanged in substance from S12 and still the rule: phases are the worker's, a share is shown only where there is a count
(channels written, renders queued, the steps of a run), and an image call is indeterminate with its elapsed time and the
typical duration. In Design the live jobs sit in one line above the canvas rather than a block of cards.

### 41.5a Measured after (`tests/studio-s18-shots.mjs after`, the same seeded project as 41.1, mocked providers)

| Window | Document height | Design artboard (top + height) | Creative Director composer |
|---|---|---|---|
| 1440 x 900 | 900 at every step (was taller than the window) | y 268, 455 px, in the window (was y 679-1139, below the fold) | y 752, in the window (was y 1348) |
| 1920 x 1080 | 1080 at every step | y 268, 658 px, in the window (was y 621-1261) | y 932, in the window (was y 1238) |
| 1024 x 768 | 768 at every step | y 268, 323 px, in the window | in the inspector drawer, one tap (`.st-insp-toggle`) |
| 390 x 844 | 844 at every step | y 333, 229 px, in the window | in the drawer, as above |

No step scrolls the page and nothing scrolls sideways at any size. To make room for the artboard, the Design foot
went from four rows to two: the page strip shares a row with the measured / save line and the composition tag, and in
Design the readiness strip clamps its explanation to one line (the full readiness sits in Checks). Guides (safe area,
likely subjects) are off by default and remembered per browser (`ax_studio_guides`). An outline someone asked for
("show on the tile") shows whether the guides are on or not. On a phone the floating Properties and Creative Director
button has room to scroll past. The mockup's artboard is about 505 px in a 1050 px frame; ours is 455 px in 900, with
the measured state, page strip and readiness the mockup did not have. The before / after sheet was composed from the
captures (Design, Creative Director, Brief, Review & Delivery at 1440, the mockup, and the phone and tablet Design).

### 41.6 Limits and what is not verified

- Every capture and every test runs against the worker module in-process with **every provider mocked**; no paid generation
  was run. The imagery in the captures is synthetic.
- The comparison with the mockup is of proportions and hierarchy; the mockup's simulated scores, progress and approvals were
  not adopted - every figure in the Studio comes from the record.
- The legacy views inside the island (Sources, Sequence, Recipes and usage, the Brand workspace's long tables) inherit the new
  frame but were not redesigned.
- At phone width Design is usable but cramped: the asset title truncates beside the zoom control and the canvas foot
  scrolls inside its own region. The canvas editor's tool row scrolls sideways (faded at its edge) rather than wrapping.
- The Studio's frame was rebuilt; AXIOM's other screens were not touched, but `index.html`'s Studio block lost its frame
  rules, so a page served with an older `studio-shell.css` cached would look wrong until reloaded (the page scripts and
  styles carry `?v=r12`).

### 41.7 Compatibility and deployment

- The page (`docs/`, `?v=r12`) works with the deployed p33 worker: every route it calls exists there. Two things need the
  p34 worker: the campaign `accent` field is kept by `kitStructured()` only from p34 (an older worker drops it, and the
  accent then falls back to the client's primary), and the worker's own messages say "Art Director" until p34 is deployed.
- Deploy the worker with `tools/deploy-worker.sh` (never `wrangler deploy` from the repository root); the deploy script proves
  `2026-10-07.studio-p34` on `/engine/status`. No D1 migration, no new secret, no new binding.
- Nothing was deployed and no live model or image call was made in S18.

## 42. S19 - data safety, the canvas workspace and an exact Creative Director (build studio-p35, page r13)

### 42.1 Problems found, and their root causes

Baseline: S18, commit 225aa54 (build p34, page r12). Each data-safety defect was written as a failing test first
(`tests/studio-s19-browser.mjs` A-C; all failed on the baseline, `s19/baseline-fail.txt` in the session scratchpad).

1. **A version save destroyed the recovery draft before the save succeeded.** `save()` in the layout editor discarded the
   server draft and cleared its own state, then posted the version; a refused or timed-out save left nothing to recover, and
   autosave stopped. Root cause: discard was sequenced before the acknowledgement, and unconditional on the server.
2. **A conflict while saving dropped the words typed on the canvas.** `putLayout` retried a 409 with the layout only; the
   `copyPatch` of the same edit was not carried into the retry. Root cause: one logical edit (layout + words) travelled as two
   things, and only one of them through the conflict path.
3. **Fast navigation lost edits.** The working layout lived in the editor component; leaving the asset inside the 1.2 s draft
   debounce (or with a text field open) unmounted it with the edit. Root cause: unsaved state owned by a component's lifetime.
4. **The Creative Director could be sent nowhere, or anywhere.** Outside Design it was given no asset, so its "This asset"
   target pointed at nothing; the copy partner's quick asks relied on the app-wide selection, which could be empty while Copy
   showed its first piece; a direction for "this asset" was therefore sent with whatever was selected elsewhere, or refused
   only at the worker. Root cause: the target of a direction was implicit state, not named by the sender.
5. **Review findings could not be acted on.** An inspection named problems in prose only - no element, no statement of what a
   correction keeps or whether it renders, no undo.
6. **Generated is not visible.** An image on record that the browser failed to fetch was noted only in the composition tag;
   the tile looked finished. Root cause: one boolean (image key present) stood for both "generated" and "drawn".
7. **Interface weight.** The tool row showed every arrangement control, disabled, with nothing selected; the reframing bar
   sat over the artwork; Copy listed its pieces twice (rail and its own list); a running job pushed the canvas down as a panel.

### 42.2 What changed

- `docs/studio-merge.js` (`STMerge`): the three-way merge of one canvas edit (layout by layer id + copy fields) against the
  version it was made on; conflicts go to `ConflictDialog` (Keep mine / Keep theirs / item by item / Cancel).
- `saveEdit()` carries the whole edit through every round, posts with an op id, verifies the saved version contains it,
  and only then calls the guarded discard. Worker: `POST /studio/version {op}` is idempotent per asset
  (`json_extract(context,'$.op')`), never bypassing the revision check for a different op; `POST /studio/draft/discard
  {savedVersion}` deletes only the draft on that base written no later than the version.
- `WORK` (`window.STWork`): the working copy outside the editor, per key fingerprint and asset, in memory and localStorage,
  flushed on `pagehide`; the open text field's words fold into it as they are typed.
- Canvas workspace: contextual tool row, View menu, crop mode with Apply / Cancel in the tool row, folded secondary
  sections, `usePanelWidth` for the inspector and the tool panel (pointer and keyboard, remembered), an inspector that folds
  to a rail, layer search / swatches / rename, a one-line activity in Design, one list of pieces in Copy.
- Creative Director: the asset on screen in every stage (picker outside Design), only real targets with counts, a refusal
  instead of a widened target, findings and corrections with `element` / `layers` checked against the judged version,
  Changes / Keeps / Needs / Lands as, "select it", Undo after a correction.
- `imageryState()`: queued, generating, failed (last usable kept), loading, did not load (load again), hidden, none, drawn.
- Checks state which saved version they judge while the canvas holds unsaved changes.

### 42.3 Tests

New: `studio-s19-browser.mjs` (16: A-C data safety and their variants, D tool row, E panels, F layers, G Copy, H the
Creative Director's scope and targets, I review elements, J a late render merging with unsaved edits, K imagery that did not
load, L the scope of Checks), `studio-s19-worker.mjs` (8: op idempotency, the guarded discard, per-person drafts, read-only,
review elements, HOOF / MCA identity separation), `studio-merge-test.mjs` (10), `studio-s19-perf-browser.mjs` (3).
Updated for the new interface, never weakened: the activity harness reads the one-line form and opens details; the framing
harness uses Apply / Cancel; the effects harness opens its section; studio-browser reads Copy's own list and the
Conversation tab; studio-s9's issue highlight keeps the Checks tab open.

### 42.4 Performance, measured

`tests/studio-s19-perf-browser.mjs`, headless Chromium in the cloud sandbox (no GPU), a 1080 x 1350 composition of 50
layers over a photograph with three salient regions. Same harness on the S18 baseline and on S19:

| measure | S18 | S19 |
|---|---|---|
| full draw at 1080 px, median / worst | 4.4 / 6.5 ms | 4.6 / 8.3 ms |
| validate(), median / worst | 34.8 / 49.6 ms | 32.3 / 44.2 ms |
| frameSuggest(), median / worst | 2.6 / 7.3 ms | 2.1 / 3.5 ms |
| drag, frame interval p50 / p95 / worst | 16.7 / 16.7 / 16.8 ms | 16.7 / 16.7 / 16.8 ms |
| drag, long tasks (> 50 ms), during and after | 0 / 0 | 0 / 0 |
| drag, pointer to next frame p50 / p95 | 12.3 / 15.4 ms | 12.6 / 15.0 ms |
| keyboard nudge, input to paint (Event Timing) p95 | 32 ms | 32 ms |

The canvas met the budgets (60 fps while dragging, interaction p95 under 100 ms, no long task) before S19 and still does;
S19 added no measurable cost. validate() of 50 layers is the heaviest single call (up to ~50 ms); it is debounced 250 ms
after an edit and never runs during a drag. Provider latency (model calls, image generation) is not in these figures: it is
reported per job by the activity panel (`studio_dur_<stage>`), separately.

### 42.5 The screen, measured

`tests/studio-s19-shots.mjs before` (on the S18 checkout) and `after`, the same seeded projects, every step plus a layer
selected, reframing, a validation failure, the Creative Director and a job running; `tests/studio-s19-sheet.mjs` lays them
side by side (`tests/shots/s19/compare-<size>.png`, ignored by git). Artboard height in the Design step:

| state | 1440 x 900 | 1920 x 1080 | 1024 x 768 | 390 x 844 |
|---|---|---|---|---|
| design, nothing selected | 455 -> 454 px | 658 -> 656 | 323 -> 322 | 229 -> 229 |
| a job running | 330 -> 410 px | 533 -> 612 | 198 -> 282 | 122 -> 167 |
| a layer selected | 455 -> 454 px | 658 -> 656 | 323 -> 293 | 229 -> 229 |
| reframing | 455 -> 450 px | 658 -> 652 | 323 -> 322 | 229 -> 229 |

A running job no longer pushes the canvas down (+24% to +42% of artboard height). At 1024 px a selection's arrangement tools
wrap to a second row (30 px less artboard) where S18 cut them off at the edge of the row; on a phone the row scrolls
sideways instead. The Creative Director now appears in Copy (no S18 capture exists for that state).

A note on method: the first "after" run showed the S18 interface. A static server left running from the baseline capture
still held the shots port and served the old pages; the captures were discarded, the server stopped and every "after"
capture retaken. Figures above are from the retaken set.

The whole suite (`node tests/run.mjs all`) ran 114 suites: 113 passed and `studio-s17-browser` failed once on a step that
was clicked while still locked (the reload after the previous choice had not landed). It passed alone, twice, and under
4x CPU throttling; the harness now waits for the step to open before clicking.

### 42.6 Limitations

- Measured on one machine class (headless, no GPU); a designer's laptop with a large photograph and a high-DPI canvas will
  differ. The harness is in the suite so a regression shows.
- The merge resolves at layer granularity: two people changing different properties of the same layer is a conflict a person
  decides, not merged property by property.
- Review elements are as good as the model's naming: an element is shown only when this version has it; a correct finding
  the model did not tie to a layer is shown without "select it".
- Imagery load state is per browser: "did not load" says this browser could not fetch or decode it, which may be a network
  matter rather than a missing file.

## 43. S20 - an agency workspace: four defects, five phases, a canvas that dominates (build studio-p36, page r14)

Baseline: commit c51d813 (S19, build studio-p35, page r13). Every provider in the harnesses is MOCKED; nothing in this
section was generated by a real model, and nothing was deployed.

### 43.1 Four defects, each reproduced by a failing test first (commit 870f4ba)

| | Defect | Root cause | Fix | Tests |
|---|---|---|---|---|
| A | A suggestion applied for one asset was sent as a whole-set instruction | Apply reused the composer's target and sent no asset or version | Every send carries an explicit scope (target, asset, version, layers); a suggestion carries its own; before sending, the server's current version is read and a suggestion made for an earlier version is refused with the reason; the worker refuses a revise job whose version moved (`stale_version`, not retried) | s20-browser A, A2, A3; s20-worker |
| B | Editing while a save was pending lost the newer edit | The acknowledgement of save A cleared the working store and the server draft, which by then held edit B | A save is bound to an immutable snapshot (`pending` in the working store); the acknowledgement clears only that snapshot; newer edits are rebased onto the saved version by a three-way merge; drafts carry a sequence (`seq`: a late older write never replaces a newer one); after a save, drafts written before the snapshot's moment (`upto`) are discarded and later ones kept; a save cut off by a reload keeps its snapshot named (outcome unknown) | s20-browser B, B2, B3, B4; s20-worker |
| C | Concurrent reordering silently dropped one person's order | Stacking order was not merged: one array won | Order is merged pairwise as document state; an incompatible order is a conflict of kind `order` in the conflict dialog; additions, deletions and groups are placed by their neighbours | merge-test (15) |
| D | The lock check missed family and leading | A short list of guarded properties | One contract, `ST_LOCK_FREE` = name, renamed, locked: every other property of a locked layer is protected on manual saves, in the editor, in AI layer edits (`stApplyLayerOps`), in repair, and when resizing to another format (`stKeepLocked`: every property but the box and type size); an unlock is explicit and recorded in the version note | s20-worker (11 lock fields, locked words, rename, unlock, resize) |

The S17 editor's autosave case found a second B-family defect on the way: after a save, the rev-guarded discard kept an older
draft, which was then offered back as "restore" and blocked autosave. The discard by `upto` is the fix.

### 43.2 Five phases over seven gates

The navigator shows **Brief, Explore, Copy, Design, Review & Deliver** (`PHASES` in `docs/studio.js`); the worker's seven steps
and gates (`stWorkflow`) are unchanged. Brief holds Understanding, Objectives and Strategy as steps shown in its head with their
states; Explore is the directions; Review & Deliver holds approvals and the delivery package. A phase's state is the first of its
steps that needs attention (error, processing, review, in progress); a click lands on its first open step on a guided project, on
its first step otherwise. Alt+1..5 moves between phases. The navigator sits in the header - one 50px bar for the project, the
phases and the status - instead of a bar of its own.

Each phase answers three questions in one place: **what am I working on** (the "Working on" line with the step's note), **what
needs attention** (blocked with the reason, needs review, processing, or "Your decision: ...") and **the next action** (one
primary button). What a phase needs, produces and decides, and what happens next, are behind the help toggle.

### 43.3 The Design workspace

Design has no stage-head row: its views (Canvas, Board, Recipes, Jobs) and its one main action ("Continue to Review", in the
campaign accent) ride in the canvas bar beside the zoom; Checkerboard, Compare and previous / next asset fold into More. The
readiness line under the canvas is one line. Measured in the app (`tests/studio-s20-shots.mjs`, the same seeded project before
and after, 4:5 Instagram tile, library closed, inspector open):

| Window | Before (S20a) | After (S20) |
|---|---|---|
| 1440 x 900 | 454 px | **618 px** (target 560) |
| 1920 x 1080 | 657 px | 798 px |
| 1024 x 768 | 322 px | 486 px |
| 390 x 844 | 229 px | 324 px |

W1 in `tests/studio-s20-browser.mjs` asserts the 1440 figure in the app on every run. On a laptop the inspector opener is an
edge tab; on a phone the header is two rows and the main action stays.

### 43.4 The Creative Director

Three areas: **Review**, **Explore** (formerly Ideas) and **Conversation**. The scope line always names client, campaign, asset,
version and the selection ("no layer selected (the whole tile)" when none). Each suggestion states Changes, Keeps, Scope (the asset
and version, "only"), Generation (no render / needs a render, proposed first), Why and Basis (rule, preference, reference,
inferred - with what each means). **Edit instruction** puts it in the composer and sends nothing; **Apply** sends it as it stands
with its own scope, and once its version lands the card offers **Undo** (restore the version before as a new version). A visual
preview before applying is not offered: it would need the model call it previews; the result is a version that History compares.

### 43.5 Generation and diversity

- **Composition diversity** beside the argument diversity: `stCompDescriptor` reads what each direction says it would draw
  (medium, imagery full / split / inset / chart / none, where the words sit, type scale, palette words) and
  `stCompositionDiversity` scores the set (medium 0.3, imagery 0.25, words 0.2, scale 0.1, palette 0.15); a pair under 0.3 apart
  is named as looking alike on the page. It is a reading of descriptions, not of rendered pixels, and says so on the board, in the
  job log and in the event (`argument`, `composition`, `lookalikes`).
- **Sketches by plan:** each direction card's free preview is laid out from its descriptor (image areas as dashed sketch boxes,
  words where it says, the type scale, the palette), labelled "sketch: ... nothing generated"; Explore leads with all the
  sketches side by side above the long cards.
- **Preservation choices:** Refine and Explore take an optional Keep (the photograph, the approved words, the composition); a
  tick is sent as an explicit answer the worker binds; nothing ticked keeps each action's own defaults. Layout alternatives
  always keep the photograph and the words; a new design sets its own.
- Both production modes are unchanged (editable composition; Full AI finished bitmap read back before approval; Switch to
  Editable makes a derived asset).

### 43.6 Knowledge and validation

- **The campaign address is resolved explicitly** (`stCampaignUrl`): the campaign's own URL from the kit, or `unresolved` -
  never another campaign's. `stChecks` flags any web address shown on a piece that is not the campaign's (`url_mismatch`, naming
  the campaign it belongs to) and any address on a piece with no resolved campaign URL (`url_unresolved`). The Brand tool shows
  the resolved address, its source and the campaign CTA. HOOF and MCA addresses cannot be swapped silently.
- Type sizes are shown and typed in **pixels at the output size** (the layout still stores a share of the width so it scales
  with the format); tracking in thousandths of an em.
- **Fix layout** offers "Compare before and after" beside Undo fix.

### 43.7 Higgsfield (section 10 of the request)

Not built. From this environment `docs.higgsfield.ai`, `cloud.higgsfield.ai` and `platform.higgsfield.ai` are refused by the
egress proxy, the worker holds no Higgsfield credential, and the API could not be read or tried. An adapter written against an
API nobody here could verify would be invented; the image path stays Gemini. To evaluate it: read the image-generation and
marketing-studio-image pages, put a key in Cloudflare as a secret, and add it as a second provider behind `nanoRender`'s
interface (server-side only, the same job records, no second generation system).

### 43.8 Performance (`tests/studio-s20-perf-browser.mjs`, headless Chromium, 50-layer composition)

| Part | Figure |
|---|---|
| Canvas: draw / measure / validate at 1080 x 1350 | median 4.8 / 0.7 / 35.9 ms (worst 7.9 / 1.5 / 47.9) |
| Canvas: drag | frame interval p95 16.8 ms, pointer-to-frame p95 17.4 ms, no long task |
| Canvas: keyboard nudge | p95 32 ms of the presses Event Timing reports (it reports only those over 16 ms) |
| Network: /studio requests opening and saving | 7 requests, p50 17.7 ms, p95 66.4 ms - the worker in this process over SQLite, not the deployed worker |
| Provider | not measured: mocked here; real figures come from `/studio/status` durations on the deployed worker |

Interaction p95 is under the 100 ms budget in every measured interaction.

### 43.9 Limitations

- Every harness runs with providers mocked; no real model or image call was made, and no generated output is claimed.
- The brief-to-export path is demonstrated by `studio-journey-browser.mjs` (mocked); `tools/studio-demo.py` was not run (it
  spends real calls and needs the deployed worker and approval).
- Composition diversity reads descriptions; it does not look at rendered images.
- The 1920 / 1024 / 390 layouts are coherent in the captures; the 390 artboard is 324 px, a phone is not a production surface.
- Not deployed: the worker build `2026-10-07.studio-p36` and page `?v=r14` go live only when the branch is merged and the worker
  is deployed from the laptop.

## 44. S21 - what the first live run found, and the fixes (build studio-p37, page r15)

### 44.1 The run

On 7 October 2026 the demonstration ran for the first time against the live worker with real Claude output:
`tools/studio-demo.py --cases hoof,mca --approve-calls 12`, no images approved (typographic tiles). It spent 10 model
calls and no renders. What held: three genuinely different directions per client (HOOF diagram / carousel /
typographic, diversity 0.91; MCA carousel / typographic / diagram, 0.90), the refinement as a free layout version, the
adaptation to the other channels, the mark separation (HOOF tiles carry only the HOOF wordmark, MCA tiles only the MCA
logo; isolation clean), Fix layout naming what it could not fix, and the share gate refusing failing work. What failed:
none of the seven composed tiles passed the technical validation, so neither case reached client review.

| Case | Tile | Blocking after repair |
| --- | --- | --- |
| HOOF | Instagram 4:5, Facebook 1:1 | `occluded` (text2 under shape3) |
| HOOF | LinkedIn 16:9 | `occluded`, `unreadable_type` x3 |
| MCA | LinkedIn 1:1, Facebook 4:5, Facebook 1:1 | `off_canvas` (text13, text14), `mark_unreadable` (logo) |
| MCA | Facebook story 9:16 | `mark_unreadable` (logo) |

The mocked harnesses could never have shown this: the stub plans were written to pass.

### 44.2 Causes and fixes (each reproduced by a failing test first)

**A. An intended device read as occlusion.** The HOOF refinement ("Labelled strike, louder fact") drew a bar through
the myth. The validator has an exception for an intended overlap (`overlaps` on the layer), but the plan schema had no
such field, `stPlanNormalise` did not keep one, and `stLayoutToPlan` (adaptation) dropped it. Fix: elements carry `id`
and `overlaps`; the normaliser resolves the pair on both layers when the words still read through the device (the
device under 45% of the words' height, or translucent at 60% or less, or covering a third of their box at most) and
drops an opaque block with the reason; a thin device across words with nothing declared is recognised as a strike or
an underline and recorded (`layout.intended`). The rules tell the planner a strike or underline is the words' own
emphasis: `strike` is a new emphasis, drawn by the renderer through each line after the letters, and offered in the
editor. `overlaps` is in the keys adaptation carries.

**B. Marks placed on grounds they do not read on.** Nothing told the planner what the marks look like; the MCA logo
file is about 80% transparent padding with dark ink, placed on a dark ground, and the logo had no approved variants
(only wordmarks did), while repair never boxes or recolours a mark. Fix:
- `stPngInk` decodes a PNG in the worker (8-bit, any colour type, transparent or opaque, up to 6 MP) and reads the
  ink: tone, relative luminance, ink share, whether the file is opaque. `brMarkInks` caches it per file version in KV
  `mark_ink_<v>` and attaches it to the kit as read (`logoInk`, `logoVariants[].ink`, `wordmarks[].ink`); it is never
  written into the stored kit.
- Logo variants: `POST /brand/kit {logoB64, logoVariant, logoTone, logoDefault}` stores an approved variant under an
  immutable key `brand/<ns>/logo/<variant>/<v>` beside the primary logo; `removeLogoVariant` retires one;
  `/brand/logo?ns=&variant=&v=` serves it; `tools/brand-logo.py <file> --ns mca --variant white --tone light`.
- `stGroundAt` computes the ground the plan itself paints under a box (the stage colour or gradient, then every shape
  over it; null over imagery, where the browser measures). `stMarkLayers` takes the approved file that reads there at
  3:1 and carries every file on the layer for the browser's measurement. Where no file reads and nothing holds the
  mark, the normaliser moves it to the nearest corner that reads and that no words occupy, and says so; otherwise it
  says plainly that it will not read and which variant to upload.
- The planner is told each mark's ink and the grounds it reads on (`stMarkInkText`, in the identity block every stage
  receives).
- The Brand workspace lists the logo's variants with their ink, and readiness flags `logo_tones` when the logo reads on
  one kind of ground only.

**C. Text off the stage.** Reproduced with a long stacked list (the MCA "who uses the credit" shape): `repair()`
restacks with explicit gaps and, when the column cannot move up past what sits above it, pushed the last blocks (the
support and the call to action - text13 and text14 in the reproduction too) below the frame. Fix: `fitColumns` closes
a column's gaps evenly (down to 0.4%) from where it starts so it ends at the safe foot; the type steps take over only
when even hairline gaps do not fit. The reproduction now repairs to a complete pass with no type reduced. The
normaliser also brings any text box a plan puts off the stage inside it, and says so.

**D. Adaptation shrank type under the readable line.** `stPlanForFormat` keeps type against the short side; from 4:5
to 16:9 that is a factor of about 0.56, and its floor (1.6%) was under the 1.8% blocking line. Fix: the floor is the
feed minimum (3.2% for a headline, 2.4% otherwise), type already smaller is kept as it was and never under 1.8%; and
`repair()` raises `unreadable_type` to that minimum when the complete validation allows.

**E. The demonstration gave up where the app would not.** `tools/studio-compose.mjs --repair` now takes the first
measured layout variation that passes (`STRender.variants`; no model call, no render; the version note reads "layout
variation: <name> (no render)") when Fix layout cannot clear a tile; `--no-variations` keeps the old behaviour. The
demo stops with the reason before sharing a master that still fails, instead of meeting a 409.

**F. A freeze found on the way.** The full browser run showed the S17 editor harness timing out when the Design tool
opened. Profiling showed the free layout variations (9 arrangements) and style variations (10) were computed in one
synchronous block, about 40 seconds in this sandbox, on the S20 commit as well as here (one of the two cases already
failed there). Each arrangement is repaired and measured, and the time went to reading pixels back from full-stage
canvases. Now: `STRender.variantsAsync` / `stylesAsync` compute one arrangement at a time (`opts.only`, a cancel token,
the page given a turn between each) and the island uses them; `markReadability` draws and reads only the mark's own
box, `occlusionOf` only the word's box, `contrastOf` only the union of the words and marks; canvases drawn only to be
read are `willReadFrequently`. One arrangement fell from about 1.1 s to 0.9 s and one style from 0.7 s to 0.4 s in this
sandbox (software rendering; a machine with a GPU differs), and both editor cases pass.

### 44.3 Evidence

`tests/studio-s21-worker.mjs` (14): declared and inferred overlaps, an opaque block refused, the strike emphasis, the
overlap kept through adaptation, text brought onto the stage, the 16:9 floor, PNG ink for dark, white and opaque files,
logo variants stored and served, the light variant chosen on a dark ground, the move to a corner that reads, the held
mark's plain statement, the planner's mark line, a logo whose ink could not be read left alone. `tests/studio-s21-browser.mjs` (12, Chromium): the strike's pixels
read back, the intended overlap passing where the unrecorded one is occluded, the list repaired with nothing off the
stage, small type raised, a measured variation that passes where repair cannot. `tests/studio-compose-test.mjs` (14):
the covered tile failing with `--no-variations` and passing as "layout variation: Band across the foot" without it.
All providers mocked; nothing was spent.

### 44.4 Limits

- Not yet proven live: the fixes are tested against reproductions, not against the live run's own projects (the
  sandbox cannot reach the worker or its data). The next live run is the proof.
- The MCA logo will read on dark grounds only once an approved light variant is uploaded; until then the planner is
  told to keep a light ground under it, and a plan that does not is moved or named.
- Ink is read from PNG files only; a JPEG or WebP mark falls back to the tone its uploader gave.
- The ground is known only where the plan paints it; over a photograph the browser's per-pixel measurement decides,
  as before.

## 45. S22 - long model calls, streamed (build studio-p38, page r16)

### 45.1 The report

On 8 October 2026 the guided brief stopped on its processing card: "Understanding your brief - Checking campaign
relevance, topics, issues, facts and risks and drafting objectives and the strategy Axiom recommends - 1 of 4",
"1 min 7 s so far. One model call: no share is shown until it answers." The person could not tell a long answer from
a stuck one, and after a while it was a stuck one.

### 45.2 What was happening

The reading (`stAnalyseStage`) is one call to the creative model at high effort, with a `max_tokens` floor of 16,000
and a prompt carrying the client context, the knowledge retrieved by relevance, the material and a large answer
schema. `stClaude` sent it as a single non-streamed request with `AbortSignal.timeout(240000)`:

- nothing came back until the whole answer was written; at the speed such a model writes, sixteen thousand tokens of
  reasoning and JSON can take longer than four minutes, and an answer that outran the timeout was aborted as a
  `TimeoutError`, judged transient and sent again - up to three attempts, each of which could be billed;
- the browser's step request (`POST /studio/job/step`) stayed open and silent for the whole call, which a proxy or a
  network change can close; on Cloudflare a closed client connection ends the worker's run with it;
- the job's lease was set once, before the call, to the timeout plus a minute (five minutes for the reading), so a
  runner that died was noticed only when that ran out, and then only by the next step from an open tab or by the
  tick (twice an hour);
- the page could show nothing but a clock, and "1 of 4" was the count the step before ("Matching client knowledge")
  had left behind, since the model phase reported none of its own.

### 45.3 The fix

**The answer streams.** Every Studio model call now asks for `stream: true` and reads the server-sent events
(`stSseRead`): `message_start`, the content blocks and their deltas, `message_delta` (stop reason and usage),
`message_stop`, `ping`, `error`. The assembled message is the same object the rest of `stClaude` already handled, so
the plain retry on a refused thinking field, the retry with twice the room on `max_tokens`, the refusal and empty-answer
handling and the usage accounting are unchanged. The reasoning is asked for as a summary (`thinking.display:
'summarized'`; on these models it is otherwise omitted, which streams empty thinking blocks and looks like a pause):
visibility only, billed the same.

**What arrives is shown.** Each delta moves the job's `progress.activity` on through `job.progress` (one write per
700 ms at most): `thinking` and `written` (characters received), `streamAt` (when the model last sent anything) and
a label - "thinking: 2,345 characters of reasoning so far", then "writing the answer: 12,345 characters so far". These
are counts, not a share: the length of an answer is not known before it is written. The reading's model phase now
counts its own steps (`phaseCounts`: 2 of 4 while the model writes), and so do the directions calls.

**Three clocks run beside the call.**
- The lease is renewed every `STUDIO_LEASE_BEAT_MS` (default 30 s) to `ST_LEASE_MS` (2 minutes) ahead, so a runner
  that stops is noticed within two minutes. `job.lease` and `job.progress` now answer whether the attempt still owns
  the job; a renewal or a progress write that finds it cancelled or taken over aborts the fetch, so a cancel stops the
  generation itself (within a progress write while it writes, within a beat when it is quiet) instead of letting it
  run on and be billed.
- A stream that sends nothing at all for `STUDIO_STREAM_IDLE_MS` (default 120 s; the API pings while it works) is
  abandoned as `stream_idle` and retried. A stream that ends before `message_stop` is `stream_cut` and retried. An
  `error` event is `overloaded: the answer stream reported ...` and retried. None of them is ever parsed as a partial
  answer.
- A call still writing after `STUDIO_STREAM_MAX_MS` (default the larger of 10 minutes and 40 ms per max token) is
  stopped as `stream_cap` and not retried: the same request would very likely do the same again.

An answer that is not an event stream - an error status, or a proxy that answers in one piece - is read as JSON exactly
as before.

**The step request keeps its connection.** `stStepRespond` answers `POST /studio/job/step`: a step that finishes
within `STUDIO_HEARTBEAT_MS` (default 15 s) answers as before; one still running then begins its answer and sends a
single space every interval until the job's JSON ends it (JSON allows the leading whitespace; `Cache-Control: no-store,
no-transform` so an edge that compresses does not hold the spaces back). After the first space the status is
committed, so a failure is written as a JSON error body (`studio_failed`); an unknown job is still a plain 404, checked
before anything is streamed. The Python tools' step loops stop with that error instead of a `KeyError`.

**The page carries on when the connection drops.** `runJob` treats a step that ends without an answer from the worker
(a network error, an answer cut off mid-body, a gateway page with no error code) as a dropped connection, not a
failure: it reads the job, keeps waiting while a runner holds the lease (up to 400 rounds of three seconds), and steps
it again when the lease runs out. An answer from the worker that is an error is shown as before. The processing card
says what has arrived ("The model is answering: 12,345 characters of the answer written", with the count beside the
current step and "nothing new for N s" after twenty quiet seconds), says "Trying again (attempt 2 of 3): the model's
answer stopped arriving" when a transient failure requeued the job, and the activity panel's foot no longer says a
model call shows nothing until it answers. `explain()` words the three stream failures. The cancel note on the
worker and in the page says what is now true: a model call that is writing stops within half a minute (what it wrote
may be billed); an image generation already sent may still finish and be billed.

### 45.4 Evidence

`tests/studio-s22-worker.mjs` (9), the worker in process with a streamed Messages API stub: the request asks for a
stream and the reading is assembled and filed; mid-stream the activity counts thinking, then characters of the answer
with a label that says so, and the lease moves forward beat by beat; a silent stream is abandoned at the idle limit and
requeued (well before the stream itself ends); an error event and a cut-off stream are requeued and never parsed;
cancelling mid-stream returns the cancelled job, aborts the provider call and files nothing; the step answer begins with
whitespace and ends with the JSON while an unknown job is a 404; the model phase counts 2 of 4; a plain JSON answer is
still accepted. The first eight failed on the S21 worker; the ninth guards the path that did not change. `tests/studio-s22-browser.mjs` (2, Chromium): through the wizard, the
processing card shows 2 of 4 and the characters that have arrived, the count grows, and the understanding opens; a step
whose connection drops while the worker carries on is waited for and opens the understanding, with no error and no
second attempt. Both failed against the S21 page. `tests/studio-progress-test.mjs` gained the stream cases of the job
model. Every other backend and browser harness passes unchanged except two assertions in `tests/studio-p2-worker.mjs`
that named the thinking setting, updated for `display`. All providers mocked; nothing was spent.

### 45.5 Limits

- Not yet proven live: the sandbox cannot reach the model API. The event format and the summarized thinking display
  follow the Messages API documentation; the first reading after this deploy is the proof.
- When the browser's connection to the worker drops, Cloudflare ends the worker's run with it; the job is taken up
  again when its lease runs out (two minutes now, five before) by the next step from an open tab, or by the tick when no
  tab is open. Closing the tab still leaves a running job to the tick.
- A model that sends no reasoning summary shows "the model has started" and, after ninety seconds without an update,
  the activity panel's "no update" note; the idle limit (two minutes of nothing at all, pings included) is what ends a
  call that has really stalled.
- A cancelled call is stopped, not refunded: the tokens produced before the stop may be billed.

## 46. S23 - production reliability, a professional workspace and a complete creative workflow (build studio-p39, page r17)

This section is the working record of S23: the baseline it started from, the checklist it is held to, the bug ledger and
the evidence. It is updated with every slice; an item is marked done only with the test or capture that proves it.

### 46.1 Baseline (verified 8 October 2026)

- `origin/main` = `6eac13a` (S22), worker build `2026-10-08.studio-p38`, page assets `?v=r16`. The working branch
  `claude/peaceful-gates-g1t4ss` held two commits beyond it, both documents (the S23 prompt), so p39 / r17 is the next
  release.
- Full suite on the baseline (`node tests/run.mjs all`, providers mocked): 119 of 121 passed. The two failures
  (`studio-modes-browser.mjs`, `studio-s10-browser.mjs`) were render cases that ran while the defect-A fix was half
  written in the working tree; both pass on the finished fix (4 of 4, 3 of 3). The checks (syntax, ASCII, the shared
  RULES block, page scripts, nothing private in `docs/`) passed.
- No paid model call is made while S23 is built: Claude and Gemini are mocked in every harness. The owner-run live
  test is `tools/studio-smoke.py`, capped (described below when it lands).

### 46.2 Checklist

Status: **done** (with its evidence), **in progress**, **planned**, **deferred** (with the reason).

| # | Requirement (S23 prompt) | Status | Evidence |
|---|---|---|---|
| 1 | Baseline verified; checklist, bug ledger, wait inventory written | done | this section |
| 2A | Required marks never dropped from an image request; records read from the payload | done | `studio-s23-worker.mjs` A1-A7 |
| 2B | One filtered context package; excluded references reach no model, as text or image | done | `studio-s23-worker.mjs` B1-B5 |
| 2C | Suggestions keyed on a context fingerprint; outdated advice marked; no older answer over a newer one | done | `studio-s23-worker.mjs` C1-C3 |
| 2D | Examples labelled by explicit metadata; rejected material is "avoid", never "imitate" | done | `studio-s23-worker.mjs` D1-D4 |
| 2E | Stream read as the documented state machine | done | `studio-s23-worker.mjs` E1-E9 |
| 3 | Visibly redesigned workspace (library, stage heads, brief, Explore, Copy, Design) with before / after captures | planned | |
| 4 | Creative Director: scope, Review / Explore / Conversation, stated cost of each suggestion, guarded apply | planned | |
| 5 | Canvas: elements, context menus, arrange, smart guides, rulers, text auto-fit, colour, crop, pages as assets | planned | |
| 6 | Both creation paths explained; image lifecycle (stored versus displayed) | planned | |
| 7 | Validation, repair and export agree; render fingerprint | planned | |
| 8 | Brand memory: reference metadata, HOOF variants verified, knowledge-gap report | planned | |
| 9 | Every long operation visible and recoverable (the wait inventory, below) | planned | |
| 10 | Error boundaries, offline, budgets measured, axe, three browsers, console guard | planned | |
| 11 | Evidence package, `tools/studio-smoke.py`, docs, p39 / r17 | planned | |

### 46.3 Bug ledger

| Id | Defect | Reproduced by | Fixed in | Status |
|---|---|---|---|---|
| S23-A | A finished creative could leave out the campaign's required wordmark: `nanoRender` kept the first six images it was given and `stRenderJob` appended the marks after the references, while the version recorded the mark as sent (`marksSent` was written before the request). The prompt was also cut at 8,000 characters, which could cut the identity rules and the approved words at its end. | A1 (six references + wordmark), A2 (current image + logo + wordmark), A3 (fallback model), A4 (required over the limit), A5 (long prompt) - all failing on `e67f0e5` | slice A | fixed |
| S23-B | A reference excluded as another campaign's still reached the models: the suggestions, directions and revise calls sent the raw bundle text (its name and analysis), concepts and suggestions accepted its id as a cited basis, a render could attach its image, and even the pack text named it ("EXCLUDED FROM THIS PACK: ..."). | B1-B4 failing on `438104d` | slice B | fixed |
| S23-C | Suggestions were cached on version, references and last event only, so a retired rule, a re-analysed reference or a changed campaign left the old advice standing as current; and an older answer still in flight could overwrite newer advice (a KV write with no order). | C1-C3 failing on `cffc482` | slice C | fixed |
| S23-D | `contentExemplars` labelled everything of kind copy, outcome, brief or release "APPROVED EXAMPLES" - rejected work (LOSS outcomes), background briefs and other campaigns' captions included - and judged a document's campaign by whether its source contained the campaign id anywhere. | D1-D4 failing on `795a136` | slice D | fixed |
| S23-E | The stream reader waited for the connection to close after `message_stop` (and then failed the finished answer as idle and paid for it again), accepted a stream that closed after an `end_turn` delta with no `message_stop`, and skipped a data frame that did not parse, so an answer could arrive with a piece missing (the test shows "not a subsidy" arriving as "a subsidy"). | E1, E2, E4, E6 failing on `0049485` (slice A) | slice E | fixed |

### 46.4 Slice A - the image request is chosen before anything is sent

- **Per-model input limits** (`ST_IMAGE_INPUT_LIMITS`, from Google's image generation guide and model pages as read on
  8 October 2026): `gemini-3-pro-image` 6 (up to 14 inputs, 6 objects at high fidelity), `gemini-3.1-flash-image` 10,
  `gemini-2.5-flash-image` 3 (best with up to three). Marks and references are objects to reproduce or follow, so the
  Studio attaches no more than the high-fidelity count; `STUDIO_IMAGE_INPUTS_MAX` lowers it for every model.
- **Required first** (`stImageAttach`): the current image to edit, then every required mark, then the optional
  references. When they do not all fit, the reference's purpose decides which stay (`ST_REF_RANK`: approved and brand,
  then composition and typography, then mood and imagery, then inspiration); the ones kept are attached in the order
  the plan named them, and each one left out is named with the reason. A request that cannot carry its required images
  is not sent at all (`required_assets_over_limit`, not retried); a model in the fallback chain with a smaller limit is
  skipped rather than sent a request without the mark.
- **No blind truncation** (`stPromptFit`, `ST_IMAGE_PROMPT_MAX` = 20,000 characters): a prompt is a list of parts,
  essential or optional. Essentials are never cut; optional parts give way in order and are named on the version
  (`image.meta.promptDropped`); essentials over the limit stop the job before the call (`prompt_over_limit`, not
  retried). The finished-creative prompt is built as parts (`stFinishedPromptParts`: format, words, address, marks,
  identity rules, palette and rules, the team's direction are essential; the concept is optional).
- **Records from the payload**: `nanoRender` builds the request for each model and returns `attached` (kind, role,
  name, mark, required), `excluded` and `promptDropped` from that request; `marksSent`, `image.meta.attached`,
  `excludedRefs`, the compiled-instruction record and the thread's "Render finished" line are read from it. A finished
  render whose wanted mark is not among the attachments is not filed (`mark_not_sent`). References a caller supplies
  (`/nano`, a raw `references` list on a job) are optional material and cannot pose as marks; the Release Desk's logo
  is a required mark.

### 46.5 Slice E - the answer stream as the documented state machine

The Messages API streams `message_start`; for each content block `content_block_start`, its deltas and
`content_block_stop`; `message_delta` (the stop reason and the cumulative usage); and `message_stop`, which alone
completes the message. `ping` may come at any time, `error` ends the stream, and new event and delta types may be added
and are to be ignored. `stStreamMachine` reads exactly that:

- **finished on `message_stop`**: reading stops there, whether or not the connection closes; a clock (idle, cap) that
  fires in the same moment does not undo a whole answer, but a fenced attempt (cancelled or taken over) files nothing;
- **cut without it**: a stream that ends before `message_stop` is `stream_cut` even when the stop reason has arrived,
  and is retried; nothing from it is parsed;
- **violations refuse the answer** (`stream_protocol`, retried): a data frame that is not JSON, a delta or stop for a
  block that never started or already stopped, a block started twice, text for a non-text block, anything before
  `message_start`, `message_stop` while a block is open;
- **tolerated**: `ping`, SSE comment lines, events with no data, unknown event types, signature and citation deltas;
- **decoding**: LF, CRLF and lone CR line ends; a CR at the end of a chunk waits for the next; a multi-byte character
  split across chunks is decoded whole; the last event counts without its blank line only when its data is whole JSON;
- **usage**: settled once - confirmed with the input tokens from `message_start` and the final cumulative output tokens
  from `message_delta`, or failed with what had arrived.

Tests (`studio-s23-worker.mjs`, providers mocked, bytes controlled): E1 open connection after `message_stop` (finished
in milliseconds, not at the idle limit), E2 no `message_stop`, E3 a stream cut every seven bytes with CRLF and multi-byte
characters, E4 an unparseable frame, E5 pings, comments and unknown events, E6 out-of-order events, E7 an error event, E8
a cancel mid-stream (the request is aborted), E9 the usage ledger. The browser fixture's stub follows the same order.
The island explains `stream_protocol` ("The model's answer arrived damaged ... none of it was used").

### 46.6 Slice B - one filtered reference package

`stCompileContext` now hands every stage the pack, never the raw bundle: `refs.text` is the pack's text, `refs.rows` the
references kept (so a model can cite only those ids, and plans are validated against them), `refs.images` only kept
references' images, and `refs.used` / `refs.unanalysed` only kept ones. What the pack left out - another campaign's
references in the recommended pack (every stage's default), references the team did not choose, or all of them by the
team's choice - is named only in the record: the version's `refPack.excluded` and the manifest's `omitted` list, with the
reason. The pack text counts the exclusions ("1 excluded") and no longer names them. Renders hold the same line
(`stRefsForGemini`): another campaign's reference is attached only when the team chose it (a chosen pack recorded on the
version, or `refsChosen` on the job), and otherwise lands in `image.meta.excludedRefs` with the reason.

Tests: B1 suggestions, B2 directions / copy / revise / concepts (the payloads read for the name, the analysis, the id and
the image), B3 a model citing the excluded id gets nothing for it, B4 a render, B5 the manifest. Updated to the new
contract: `studio-p8-worker.mjs` (the excluded name is no longer in the prompt; the record carries it) and
`studio-p6-worker.mjs` (the stages read "REFERENCE PACK", not the raw "REFERENCES ON THE PROJECT").

### 46.7 Slice C - suggestions keyed on their context

The suggestions for an asset live in D1 `studio_suggestions(asset, project, fp, parts, started, at, data)`, keyed on a
fingerprint of what they were made from (`stSuggestFingerprint`): the version, the campaign, the brand kit (its saved
time left out), the learned rules of the namespace with their state and wording, the project's references with their
analyses, recipes and notes, the brief's objective, audience and message, the last feedback event on the asset, and the
artwork memory. Each part is kept, so `GET /studio/suggest?asset=` (read role, never calls a model) answers the cached
advice with `outdated` and `changed` - "the learned rules and preferences in force", "the references or their analyses",
"the campaign" and so on. `POST /studio/suggest` serves the cache only when the fingerprint matches; otherwise the
person's explicit request makes one call. An answer is filed under the fingerprint it was made from (so a change made
while it ran reads as outdated afterwards) by a conditional upsert that only replaces advice started earlier: an older
answer arriving late is returned to its own requester marked `superseded` and never replaces the newer advice. In the
island, opening an asset reads the cache for free and shows it with an "outdated" note naming the change; "refresh (1
model call)" asks again.

Tests: C1 a rule retired (outdated, then a new call without the rule), C2 a reference re-analysed and a campaign
changed, C3 two requests in flight answering out of order. The p6, p3, s20 and s7 worker harnesses and the studio and
s20 browser harnesses pass unchanged.

### 46.8 Slice D - examples by explicit classification

`mind_docs` gained `campaign`, `approval` (approved / rejected / background), `scope` (campaign / client) and
`classified` (who or what said so). `/mind/ingest` takes them, `tools/engine-ingest.py` sends them from a pack's
frontmatter (`campaign:`, and `approval:` or `status:` when stated), and every outcome the Engine files carries its verdict
and the project's campaign (`engineOutcome`: Studio approvals, the message kit, the Content Desk). `contentExemplars`
reads each retrieved document's row and groups it:

- **APPROVED EXAMPLES** (learn from them): the client's own documents approved for this campaign, or for the client as a
  whole;
- **AVOID** (never imitate): what the team rejected for this campaign or the client;
- **BACKGROUND** (context and facts, not style): briefs, releases, guides;
- **not used**: another campaign's work (counted), the agency's own namespace as an example, and anything nobody classified
  (counted and listed by `GET /mind/unclassified?namespace=`; `POST /mind/classify {docId, campaign, approval, scope}`,
  full role, classifies one, recorded as the person who did).

One labelled legacy rule keeps the voice packs that were loaded before S23 working: a document whose source is the
ingest tool's tag `pack:<ns>:<campaign>:...` and whose kind is copy is an approved caption by the voice-pack contract,
attributed to a campaign only on exact equality with the tag's segment; such documents are counted as `legacy` until
someone classifies them. The context manifest records the example sets (`exampleSets`) and lists unclassified and
other-campaign examples under `omitted`.

Tests: D1 HOOF (approved, avoid, background, nothing from national or AEP, unclassified and a substring trap unused), D2
MCA national and a client-wide example, D3 a Studio rejection filed as a classified outcome, D4 classification by a
person (a read key refused). `content-worker.mjs` updated to the new narration.
