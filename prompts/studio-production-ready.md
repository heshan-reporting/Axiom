# Claude Code prompt: make the AXIOM Creative Studio production ready (after R2, page `?v=r35`, worker p48)

Paste everything below the line into Claude Code, opened at the root of the `Axiom` repository.

---

You are working in the AXIOM repository. Read `CLAUDE.md` first: it is the system map and its rules apply. The Creative
Studio is the React island in `docs/studio.js` (with `studio-guided.js`, `studio-editor.js`, `studio-style.js`,
`studio-render.js`, `studio-progress.js`, `studio-merge.js` and the Studio CSS) over the `/studio/*` and `/brand/*` routes of
the Cloudflare Worker `axiomworkerv4.js`. `CREATIVE-STUDIO.md` holds the history of every release (s.1-s.59).

## Where it stands

- Worker build `2026-11-04.studio-p48` is live; the page is `?v=r35` (the R2 redesign: Brief, Plan, Direction, Copy, Create,
  Review, Deliver; the quick wizard; the brief form; the Creative Partner; the grouped Review checks).
- `node tests/run.mjs all` passes 172 of 172 locally (Firefox and WebKit parts skip where not installed).
- An accessibility and overflow sweep (`tests/studio-s27-sweep.mjs`) of 102 view / width / role combinations found no
  horizontal scroll, no serious or critical axe finding and no page error.
- An audit of the latest code (4 November 2026) confirmed the defects below. Each has where it is, what goes wrong and what
  done looks like.

## Rules for this work

- **Test first.** Each defect gets a test that fails on the current code and passes after the fix (worker harnesses
  `tests/*-worker.mjs` with `node --experimental-sqlite`, browser harnesses `tests/*-browser.mjs` on
  `tests/studio-fixture.mjs`). Put new cases in `tests/studio-p49-worker.mjs` and `tests/studio-r3-browser.mjs`.
- **Providers mocked only.** Make no paid Claude or Gemini call, contact no live worker, and run no `studio-smoke.py`,
  `studio-demo.py`, `studio-showcase.py` or `studio-test-kit.py --apply`.
- **Keep the contracts.** Keep the worker pure ASCII and the RULES block byte-identical between `docs/studio-render.js` and
  the worker. Keep MCA and HOOF apart: HOOF carries its own HANDS OFF OUR FUEL wordmark and never the MCA logo.
- **Approval is a person's decision.** A measurement or an AI verdict is never an approval.
- **Bump the release markers.** Bump the page's `?v=` (to `r36`) and `node tests/asset-versions.mjs --write`. Bump
  `AXIOM_BUILD` (to `studio-p49`) when the worker changes.
- **Gate and finish.** Run the whole gate (`node tests/run.mjs all`), add a section to `CREATIVE-STUDIO.md` and a paragraph
  to `CLAUDE.md`, commit to the session's `claude/...` branch and push. Do not deploy the worker: the owner does that from
  the laptop with `tools/deploy-worker.sh`.

## Confirmed defects (fix all of these)

**F1. Review names the wrong version.**
- **Where:** `ReviewIssues` in `docs/studio.js`.
- **Problem:** each issue is labelled `v${vtotal(a)}`, the number of versions, instead of the current version's number.
  After a restore, or once the history is longer than the 60-version window, it names a version that is not the one judged.
- **Done:** the label uses `vnum(a, current(a))`. A test restores an earlier version and reads the label.

**F2. Copy checks are called blocking but do not block, and approval does not mention them.**
- **Where:** `reviewIssues()` puts `differs`, `banned` and `url_mismatch` under "Blocking: must be fixed before this piece
  can be approved". `/studio/approve` approves copy regardless.
- **Problem:** the approval dialog (`ReasonDialog`) says nothing about these checks, and the approval record does not note
  them.
- **Done:**
  - These checks appear under Warnings as serious, with words that say a person decides.
  - The copy approval dialog lists them.
  - The worker appends "(approved with unresolved copy checks: ...)" to the reason of a copy approval made while any of
    `differs`, `unsupported`, `banned`, `url_mismatch` stand. The browser-only mark note sets the precedent.
  - A worker test reads the stored reason.

**F3. The brief form loses typed edits.**
- **Where:** `BriefFields` (R2) holds its edits in component state only.
- **Problem:** leaving the Brief step, opening another project or reloading drops them. S19 established that a working copy
  outlives the editor.
- **Done:**
  - A per-browser working copy (localStorage `ax_studio_bf_<project>`, never the key) is written as the person types and
    restored on return when the saved brief has not moved underneath it.
  - When the saved brief has moved, the form says so and keeps both.
  - The copy is cleared after a successful save.
  - A browser test types, leaves to another stage, comes back and finds the words.

**F4. Saving the brief fails whenever anything else touched the project.**
- **Where:** `saveBriefPatch` always sends the project `revision`.
- **Problem:** a render landing or a job finishing bumps it, so the save answers 409 "The brief was not saved". This happens
  although `/studio/project/update` merges the brief field by field.
- **Done:**
  - On 409 the page re-reads the project. If the server's values of the fields being saved still equal what the form started
    from, it sends again once on the new revision. Otherwise it names the fields someone else changed and keeps the person's
    text.
  - A browser test bumps the revision behind the form, saves, and finds the save landed.

**F5. "One visual" in the wizard is always Instagram.**
- **Where:** in `Wizard` (`docs/studio-guided.js`), `deliverable === 'visual'` hides the channel picker and `make()` forces
  `['instagram']`.
- **Problem:** a single LinkedIn or X visual cannot be made from the wizard, and the recap does not say which channel or
  deliverable was chosen.
- **Done:**
  - One visual offers one channel (a single choice, Instagram by default).
  - The recap names the deliverable and the channels.
  - A browser test makes a one-visual LinkedIn project and reads the brief's channels.

**F6. Brief channels and formats are stored as sent.**
- **Where:** `stBriefNorm` keeps `channels` and `formats` from the request unvalidated (`Object.assign({}, b)`).
- **Done:**
  - `channels` is a de-duplicated list of `ST_CHANNELS` keys.
  - `formats` maps only those channels to `ST_FORMATS` keys; anything else is dropped.
  - A worker test sends junk and reads the normalised brief.

**F7. The library miscounts and loses thumbnails on busy clients.**
- **Where:** `stList` reads the current versions of the 24 most recent projects' assets with `.slice(0, 90)`.
- **Problem:** once those projects hold more than 90 assets, later projects get no lead composition, and their
  `pieces.visual` and `pieces.copy` counts come out short or missing.
- **Done:**
  - The version read is chunked under D1's 100-variable limit.
  - Every recent project gets its lead and true counts.
  - A worker test makes 24 projects with 5 assets each and checks the last one.

**F8. A large source sweep exceeds D1's variable limit.**
- **Where:** `sourceSweep` accepts up to 150 ids and binds them in one `IN (...)`.
- **Problem:** D1 refuses more than 100 bound variables, so a sweep job naming more than 100 sources fails outright.
- **Done:** the read is chunked. A worker test sweeps 120 ids through the SQLite fixture with the 100-variable limit
  enforced.

**F9. Opening a project is serial work per asset (P1, open since p45).**
- **Where:** `stGet` builds each asset view with `await stAssetView(...)` in a loop. Each view makes several queries: versions,
  numbering, standing approvals, readiness and validations.
- **Problem:** on D1 every query is a network round trip, so a 20-asset project waits on more than a hundred of them in
  sequence.
- **Done:**
  - The views are built concurrently (bounded, about 6 at a time) and returned in the same order.
  - A worker test with a delayed D1 (`slowReads` in `tests/worker-env.mjs`) shows the wall time falling, and the same output
    as before, byte for byte.

## Then, the production-readiness checks this audit could not finish (report on each; fix what is confirmed)

1. **Live model quality has never been measured.** Write the evaluation plan, not the run: what `tools/studio-golden.py` and
   the smoke tool would measure under an owner-approved allowance, and what would count as pass.
2. **Worker cold paths on D1.** List every route the Studio calls on opening a project or a stage, with its query count. Flag
   any count that grows with versions or events.
3. **Error surfaces.**
   - Every `explain()` code the worker can answer has a human title (`TITLES`).
   - Grep the worker for `jsonResp({ error:` codes the page does not know, and add them.
4. **Concurrency.** The Brief, Copy and canvas editors each have a draft and conflict path (S19, S30). Confirm the new
   `BriefFields` joins the same pattern and that no editor saves without the revision it started from.
5. **Accessibility.**
   - Re-run `tests/studio-s27-sweep.mjs after` and `tests/studio-a11y-browser.mjs`. Any serious or critical axe finding
     fails.
   - Check keyboard-only use of the wizard: Enter on a choice selects it, and Enter elsewhere moves on.
6. **Spend.** Every paid action states its worst case from `budget.policy` before it runs (`costCeil`, `costNote`).
   Inventory the buttons that start model or image work and confirm each asks first.

Report at the end:
- the ledger: id, severity, what, where, test and status;
- the gate's numbers;
- what could not be verified in the sandbox, said plainly.
