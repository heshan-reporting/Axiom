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
node --experimental-sqlite tests/studio-worker.mjs        # Creative Studio Phase 1
node --experimental-sqlite tests/content-worker.mjs       # Content Desk routes and the creative shelf
node --experimental-sqlite tests/artwork-worker.mjs       # artwork memory
node --experimental-sqlite tests/overview-worker.mjs      # the front page and the daily brief
node --experimental-sqlite tests/narratives-worker.mjs
node --experimental-sqlite tests/sentiment-worker.mjs
node --experimental-sqlite tests/social-worker.mjs
node --experimental-sqlite tests/sources-worker.mjs
node tests/studio-browser.mjs                             # SHOT=1 writes screenshots beside it
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
- `studio-browser.mjs`: the Phase 0 prototype journey in a browser.
- The rest: the modules named in each file's header.

Confidential material never belongs here: fixtures are synthetic. A live,
cost-bounded evaluation of model output quality is a separate, authorised run.
