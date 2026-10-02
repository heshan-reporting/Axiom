# AXIOM reliability release r1

Baseline reviewed: `3481089` (Studio p23, live on `main` and on the worker).
This release sits on top of Studio p24 (`cce66f8`) on the branch
`claude/peaceful-gates-g1t4ss`. Both earlier states are kept as branches:
`backup/2026-10-02-main-p23` (what is live) and `backup/2026-10-02-studio-p24`.

**What the evidence is.** Every defect below was reproduced by a test that
failed before its fix and passes after it. The tests run the real worker module
in-process over SQLite, with every provider **mocked** (Claude, Gemini, Workers
AI, Vectorize, Slack, Reddit, Meta). A pass proves that the worker, the page and
the tools agree with each other and that the guards hold. It does not prove
what a live model answers, how Cloudflare's D1 behaves under real contention, or
what production data looks like. Nothing here was deployed, no paid generation
ran, and no live binding or client memory was changed. This release is better
tested than the baseline. It has not been validated in production.

## 1. System map

```
GitHub Pages (main /docs)                  Cloudflare Worker "newsaus" (axiomworkerv4.js, one module)
  index.html + React islands     --HTTPS-->  fetch(): request id -> handle(): route policy (axRoutePolicy)
  studio.js / studio-render.js               -> auth (axAuth: roster, admin key, dev-open on localhost only)
  review.html (client token)                 -> route handlers
                                             scheduled(): cron tick -> sources, social, sentiment, narratives,
Mac collectors (reach-agent.py)  --HTTPS-->     brief, Studio jobs, Meta, topics, Sentinel
  claim bridge jobs, stream logs
Python/Node tools (tools/*.py, *.mjs) ---->  key-gated routes (/archive/add, /mind/ingest, /studio/*)

Stores (bound to the live worker; never declared from the repo's wrangler.toml template):
  D1 MIND_DB     projects, versions, jobs, approvals, events, mind_docs, sources, sentiment, narratives,
                 bridge jobs, engine rules/outcomes, ai_usage ledger
  KV             brand kits, briefs, sessions, cursors, heartbeats (no atomic increment: no counters any more)
  R2 MIND_DOCS   documents, images, exports, compiled instructions
  Vectorize      Mind chunks by namespace (client walls: ns + cmm (+ ns_creative for creative surfaces))
  Workers AI     embeddings (bge-base)
Providers: Anthropic (Claude), Google (Gemini text + image), Slack webhooks, ClickUp, Meta Graph,
           LinkedIn, Reddit, Bluesky, Mastodon, YouTube, Google News, OpenAustralia, SIFA
```

Trust boundaries: the AXIOM key (`X-Axiom-Key`) for staff; the review token
(`X-Review-Token`, stored only as its hash) for clients; SIFA's own bearer for
`/sifa/*`; anything a model reads (sources, releases, references, retrieved
memory, web pages, posts, comments) is untrusted material.

## 2. Defects, by priority

### Reproduced and fixed

| # | Batch | Severity | Defect (before) | After |
|---|---|---|---|---|
| A1 | R1 | critical | An unknown role in `AXIOM_KEYS` (a typo such as `"r":"reader"`) or a missing role was treated as **full** access | The roster is validated whole; an invalid entry closes it (`401 auth_misconfigured`); the single admin key still opens so it can be repaired |
| A2 | R1 | critical | With no key configured the worker was **open** to everyone, including routes that send messages and spend money | Closed (`503 auth_not_configured`); `AXIOM_DEV_OPEN=1` opens only a localhost origin |
| A3 | R1 | high | Side-effect routes outside the gate list (`/clickup-attach`, `/whatsapp`, probes, live reads, `/fetchurl`, `/collect`) could be reached with a read key or none | One route policy, deny by default: every non-GET is full; GETs that act are full; unlisted paths need a key |
| A4 | R1 | high | `/fetchurl` and the forum readers fetched any address a person supplied (internal hosts, metadata addresses, credentials in the URL, redirects to them) | `axUrlProblem` refuses private, local, link-local, credentialed and non-default-port addresses; redirects are followed by hand and rechecked |
| D1 | R2 | high | `JSON.stringify(x).slice(0, N)` stored broken JSON in instructions, briefs, recipes, layouts and diagnostics; reads fell back to `{}` and a job could run with an empty input | Shrinking JSON that stays valid (`jsonFit`, marked `_truncated`) for diagnostics; instructions, briefs, recipes, directions, layouts, brand data and copy sets are **refused** past their limit with the field named (413), never cut; a job whose stored input does not parse fails visibly (`input_corrupt`); `GET /integrity` lists bad records read-only |
| B1 | R3 | high | Two saves of a brief, project or asset from the same revision both "won"; the later one silently replaced the earlier | Compare-and-swap on `revision` (affected rows checked); a stated revision that loses is `409 conflict` with nothing written; an unstated one is reapplied on the winner, so both fields survive |
| B2 | R3 | high | A stage (strategy, sequence, extract) wrote back a brief it had read minutes earlier, erasing a person's edit made meanwhile | Stages patch the brief through `stBriefPatch` (read, change one field, CAS, retry) |
| B3 | R3 | high | A version insert and the move of `current` were separate writes; two edits could both append and leave `current` on either | One transaction guarded by the expected current version |
| B4 | R3 | medium | An approval could be filed for a version that had already been replaced | Filed only while the version is current, otherwise `409 version_moved` |
| C1 | R4 | high | Two collectors asking at once could both claim one bridge job | Conditional claim (status still queued, rows checked) |
| C2 | R4 | high | A cancelled job could be requeued by a transient failure, or file its result when the provider answered late | Attempts are fenced by attempt number; cancel is terminal; a late report is `409 job_ended` and logged as ignored |
| C3 | R4 | high | A provider call longer than the 2-minute lease let a second runner start the same job, and the first could then overwrite it | The lease is extended before each provider call (Claude timeout + 60 s, renders 5 min); ownership is checked when the answer returns and before a version is filed |
| E1 | R5 | high | The asset view sent the **oldest** 60 versions; past 60, the page showed an old version as current (the frontend fell back to the last one sent) | Newest 60 plus the current version however old; numbered by `(created, rowid)` so equal timestamps number the same on every read; `versionsTotal` and `GET /studio/versions` page the rest; the page shows the version the worker names or none |
| F1 | R6 | high | Mind ingestion indexed at most 120 chunks (~126,000 characters) and reported success; a fact near the end of a long document was never findable | Every chunk is indexed, in checkpointed batches; a document that does not finish in one call is `partial` with its coverage and resumes (`/mind/ingest/resume`) without duplicates; a failure mid-way is `partial`, never ok; chunks carry their position; identical text is recognised by hash |
| G1 | R6 | high | AI budgets were KV read-then-write counters: concurrent calls lost increments and racing calls passed the daily cap | One D1 ledger (`ai_usage`): each attempt reserves with a conditional UPDATE before it is sent, then settles confirmed (with tokens) or failed; retries are counted as retries |
| X1 | R6 | medium | A failed outcome exemplar (WIN/LOSS into the Mind) was swallowed | Reported on the outcome (`exemplarError`) |
| X2 | R7 | medium | An unhandled exception answered with whatever the runtime produced, and there was no way to tie a user's report to a log line | Every answer carries `X-Request-Id` (exposed to the browser); an unhandled failure answers `500 internal_error` with the id and none of the failure's text; the log line has the id with keys struck out (`axRedact`) |
| X3 | R7 | low | Browser harnesses loaded Playwright from one machine's path; the lockfile was ignored; there was no single test command or CI | `tests/pw.mjs` resolves `PLAYWRIGHT_MJS`, the project, then the global install; `package-lock.json` committed; `npm test` (`tests/run.mjs`); `.github/workflows/ci.yml` |
| X4 | R7 | low | `content-browser.mjs` had been failing since Studio Phase 4 (the Content Desk entry now opens the Studio) | Mounts the island directly |

### Source-based risks (found by reading, guarded or documented; not reproduced as failures)

1. **Prompt injection in source material.** A release or reference can carry
   instructions. Every model call now carries a source-safety rule
   (`AX_UNTRUSTED_RULE`), and the deterministic guards (mark policy, figure
   checks, namespace walls, approval gates) hold even when the model's answer
   is subverted (`tests/ai-boundaries-worker.mjs`). **Residual:** a figure
   written inside an injected source is in the source, so the check reports
   "matches the source". The check is provenance, not truth.
2. **Cancellation during a stage's write phase.** Fencing stops a cancelled
   attempt filing new versions after its provider call returns. A stage
   cancelled while it is already writing several assets may leave the ones
   written before the cancel landed. They are ordinary versions with their
   job named, and nothing is lost or corrupted.
3. **D1 contention in production.** The compare-and-swap and reservation
   patterns rely on single-statement atomicity and `batch()` being a
   transaction, as Cloudflare documents. The tests prove the logic over SQLite
   with forced interleaving, not D1's behaviour under load.
4. **Model identifiers.** `claudeMsg` defaults to `claude-sonnet-4-6`; the
   describer and `/fetchurl` summariser use `gemini-3.6-flash` then
   `gemini-2.5-flash`. Whether these are reachable by the live keys is a live
   question (`GET /studio/models` answers it without spending).
5. **Legacy inline views** (Newsroom, Pulse, Radar, Analyst, Briefing,
   Audience) have no stale-response guard when filters change quickly. They
   are read-only displays, but a slow earlier answer can paint over a newer one.
6. **The worker is one 14,000-line module.** It deploys as one script by
   design (`tools/deploy-worker.sh`). Boundaries are enforced by tests (the
   route policy, the ledger, the shared RULES block), not by module structure.

### Unverified hypotheses (need live access to confirm or rule out)

- The brand configuration on the live worker may not match the policy (for
  example, a HOOF wordmark variant missing, or a legacy single slot beside
  variants). `tools/studio-identity.py --ns mca` reads it (read role, no spend).
- Documents ingested before this release under the 120-chunk cap are likely
  partly indexed. `GET /mind/coverage?namespace=<ns>` measures them read-only
  (section 5).
- Cron runs that overlap a manual step loop may double-place a narrative row.
  Placement is keyed on the row (`narrative_items.item` is the primary key),
  so this is expected to be harmless, but it has not been observed live.

## 3. The batches

Each batch lists the root cause, what changed, the files, the tests, what it
means for compatibility, and what is still uncertain.

### R1 Access control (commit `0546fa1`)
- **Root cause:** the gate was a list of protected prefixes (allow by default),
  and the roster parser treated anything that was not `read` as full.
- **Change:** `axRoutePolicy(path, method, query)` returns `public`, `token`,
  `read` or `full` for every request, with deny as the default.
  `axAuth` validates the roster and offers dev-open only on localhost.
  `axFetchPublic` and `axUrlProblem` guard fetches of URLs a person supplies.
  `deploy-worker.sh` refuses to deploy onto a worker with no access key.
- **Files:** `axiomworkerv4.js`, `tools/deploy-worker.sh`.
- **Tests:** `tests/auth-policy-worker.mjs` (14): every acting route is tried
  with no key, a wrong key, a read key and a full key, and the recording
  `fetch` proves that a refused request reached no provider.
- **Compatibility:** a worker with neither `AXIOM_KEYS` nor `AXIOM_ACCESS_KEY`
  now refuses everything except `/` and `/archive/stats`. Each roster entry
  must carry `"r":"read"` or `"r":"full"`. Read keys can no longer run live
  probes (`?probe=1`, `?live=1`), `/collect`, `/fetchurl` or `/integrity`.
- **Uncertain:** the live roster has not been read, so its validity is unknown.
  The deploy script refuses only when no key binding exists at all.

### R2 Persisted JSON (commit `0546fa1`)
- **Root cause:** length limits were applied to the serialised string, cutting
  JSON mid-token; readers then defaulted to `{}`.
- **Change:** `jsonFit` and `jsonShrink` for diagnostics, and
  `jsonLimitProblem` (413 with the field named) for anything that drives work.
  Limits: input 60,000, field 20,000, brief 60,000, layout 250,000. A job
  carries `inputCorrupt` and fails with `input_corrupt`. `GET /integrity`
  (full role, read-only) lists unparseable records per JSON column
  (`AX_JSON_COLUMNS`) with a recovery for each.
- **Tests:** `tests/integrity-worker.mjs` (7).
- **Compatibility:** requests over the limit that used to be silently cut are
  now refused. The Studio page explains each new error code (`explain()`).
- **Uncertain:** existing corrupt rows in production are unknown until someone
  calls `/integrity`. Nothing rewrites them.

### R3 Concurrent edits (commit `0546fa1`)
- **Root cause:** read-modify-write without a condition on the write.
- **Change:** CAS on `revision` for projects, assets and locks.
  `stAppendVersion` runs as one guarded batch. `stBriefPatch` handles stage
  writes. Approvals are conditional inserts.
- **Tests:** `tests/concurrency-worker.mjs` (8). The D1 shim's `batch` is a
  transaction and can delay after reads (`slowReads`), so two requests both
  read before either writes.
- **Compatibility:** clients that send `revision` may now get 409. The Studio
  page already handles it (Keep mine / Take theirs; the brief merges field by
  field).

### R4 Jobs (commit `b29c12a`)
- **Root cause:** the claim, finish and cancel steps were unconditional writes,
  and the lease was shorter than the calls it covered.
- **Change:** a conditional `jobClaim` and `jobFinish` (`409 job_ended`).
  Studio attempts are fenced (`job.fence`). Lease checkpoints come from
  `stClaude` and `stRenderJob`. `stJobCancel` is conditional and terminal.
- **Tests:** `tests/jobs-lifecycle-worker.mjs` (7).
- **Compatibility:** a Mac collector that reports on a cancelled job gets 409
  and moves on (`reach-agent.py` already catches a failed report, prints it
  and takes the next job).
- **Uncertain:** a worker process killed mid-call leaves the job to the lease
  (2 minutes, or the extended lease) and then the cron. Cloudflare Queues or
  Workflows would give durable execution, but that is a recommendation and is
  not implemented.

### R5 Current version (commit `b29c12a`)
- **Root cause:** `ORDER BY created LIMIT 60` (the oldest) plus a frontend
  fallback to the last version sent.
- **Change:** `stVersionPage`, `stVersionNumber`, `stAssetView`
  (`versionsTotal`, `versionsFrom`, `currentMissing`) and
  `GET /studio/versions`. In `docs/studio.js`, `current()` has no fallback,
  numbers come from the worker, and older history loads on request.
- **Tests:** `tests/versions-worker.mjs` (5); the Studio browser suites.

### R6 Knowledge indexing and AI accounting (commit `69038bb`)
- **Root cause:** a hard chunk cap with no record of coverage, and KV counters
  with no atomic increment.
- **Change:** `mindIngestDoc` is the single implementation. It stores up to
  2,000,000 characters (refused beyond), indexes in checkpointed batches of
  `MIND_INGEST_CHUNKS_PER_CALL` (400) and records `chars`, `hash`, `chunks`,
  `indexed`, `status` and `error`. Routes: `/mind/ingest/resume` and
  `/mind/coverage` (read-only). The `ai_usage` ledger has `aiReserve` and
  `aiSettle`. `/studio/budget` reports reserved, confirmed, failed, retries,
  in-flight calls and tokens.
- **Files:** `axiomworkerv4.js`, `tools/engine-ingest.py`,
  `tools/vault2mind.py`, `tools/mind-push.py`.
- **Tests:** `tests/ingest-worker.mjs` (7), `tests/usage-worker.mjs` (4).
- **Compatibility:** `mind_docs` gains columns through additive
  `ALTER TABLE ... ADD COLUMN` statements (no destructive migration). The day
  of the deploy carries over the KV count into the ledger. A budget refusal now
  stops the sentiment and naming loops instead of spinning.
- **Uncertain:** an attempt counts as "estimated" while reserved and becomes
  "confirmed" only when the provider answers. A worker killed between the two
  leaves an attempt in flight for that day, which keeps the count
  conservative.

### R7 Boundaries, diagnostics, tests and release (this commit)
- **AI dependability:** `AX_UNTRUSTED_RULE` is appended to every system prompt
  (`stClaude`, `claudeMsg`, the direct calls and the `/chat` proxy).
  `tests/ai-boundaries-worker.mjs` (7) evaluates the guards against an
  injected source and a subverted answer. It checks five things. A HOOF tile
  carries only the HOOF wordmark, never the MCA logo. Figures from another
  client or from nowhere are flagged. AEP rules and facts never reach the MCA
  context. Retrieval searches only `mca`, `cmm` and `mca_creative`. A
  malformed answer fails the stage without writing anything, and an AI "ship"
  is never an approval.
- **Diagnostics:** `X-Request-Id` on every answer, `500 internal_error` with
  the id, and redacted log lines (`axRedact`). `AXUI.call` keeps the id on the
  error, and the Studio's error notice shows it with "quote request ...".
  `tests/diagnostics-worker.mjs` (3).
- **Portability and CI:** `tests/pw.mjs`, the committed `package-lock.json`
  (Playwright 1.56.1 from the public registry), `tests/run.mjs`
  (`npm run check|test:backend|test:browser|test`) and
  `.github/workflows/ci.yml`. CI uses no secrets and calls no provider.
- **Release:** build `2026-10-02.studio-p24-r1`; page scripts load as `?v=r1`.

## 4. Before deploying (needs the operator's approval)

1. Read the live roster's shape without revealing values: confirm
   `AXIOM_KEYS` is a JSON object whose entries each have `"r":"read"` or
   `"r":"full"`, or that `AXIOM_ACCESS_KEY` is set. A typo used to mean full
   access, and it now closes the worker.
2. Deploy with `tools/deploy-worker.sh` (never `wrangler deploy` from the
   root). It keeps every binding and proves `/engine/status` answers
   `2026-10-02.studio-p24-r1`.
3. Fast-forward `main` to the branch so Pages serves `?v=r1` pages that
   understand the new error codes and version paging.
4. Smoke checks with a read key, all of which spend nothing:
   `/studio/status`, `/studio/budget`, `/mind/coverage?namespace=mca`,
   `/studio/models`. With a full key: `/integrity` (read-only).
5. Rollback: redeploy the worker from `backup/2026-10-02-main-p23` and reset
   `main` to it. The new D1 columns and the `ai_usage` table are additive and
   are ignored by the old code.

## 5. Backfill proposal (not run)

`GET /mind/coverage?namespace=<ns>` measures every document, including those
filed under the old cap, against its stored text, and lists the partial ones.
The proposal:

- Pick the documents that matter, starting with briefs, voice packs and long
  releases.
- Call `POST /mind/ingest/resume {"docId": ...}` for each one until it reports
  `complete`. That costs one Workers AI embedding batch per 400 chunks. No
  Claude or Gemini call is made.

Nothing reindexes by itself. A namespace-wide backfill is a bulk change to
client memory and needs explicit approval.

## 6. Work that needs more authority or live validation

- A bounded, authorised real-model evaluation of the injection and
  hallucination cases, with the same fixtures as
  `tests/ai-boundaries-worker.mjs` and live models, under an approved call
  budget.
- A live identity audit (`tools/studio-identity.py`) and brand gap request
  (`tools/studio-brand-gaps.py`) for each client.
- `/integrity` and `/mind/coverage` on production, with a decision on each
  finding.
- Durable execution (Cloudflare Queues or Workflows) for Studio jobs, if
  stalled-job recovery through the lease and cron proves too slow in
  practice.
- Splitting the worker into modules behind a bundler, if the team wants it.
  The route policy, the ledger and the JSON helpers are the first candidates,
  because each already has its own harness.
