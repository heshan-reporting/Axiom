# AXIOM — session guidance

AXIOM is an Australian political intelligence platform: a single-file frontend
(`docs/index.html`, served by GitHub Pages **from the /docs folder only** —
Settings -> Pages -> main //docs; this keeps `knowledge/`, the worker source
and tools off the public site) plus a Cloudflare Worker backend
(`axiomworkerv4.js`, deployed as `newsaus` — keep it pure ASCII). Design tokens
live in `docs/axiom-ds.css`; `docs/styleguide.html` documents them. Never move
non-public files into `docs/`.

## Knowledge vault (claude-obsidian)

This repo carries a source-cited Obsidian knowledge vault for research and
client intelligence, powered by the vendored
[claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) product
(MIT — see `tools/claude-obsidian/LICENSE` and `ATTRIBUTION.md`).

- Product root (code, read-only): `tools/claude-obsidian/`
  — CLI: `python3 tools/claude-obsidian/scripts/claude-obsidian.py`
- Vault (knowledge, mutable): `knowledge/` — selected automatically via the
  root `.claude-obsidian.json`; runtime state under `knowledge/.vault-meta/`
  is gitignored.
- Skills are registered project-scoped in `.claude/skills/` (wiki, wiki-ingest,
  wiki-query, wiki-retrieve, wiki-lint, wiki-fold, wiki-mode, save,
  autoresearch, canvas, defuddle, obsidian-bases, obsidian-markdown, think,
  wiki-cli). Their product-root references are pre-resolved to
  `/home/user/Axiom/tools/claude-obsidian`.
- Cloud containers are ephemeral: vault changes only survive if committed.
  After vault-mutating operations, commit and push `knowledge/`.

### The growth loop

Curation doctrine lives in the vault: `knowledge/wiki/concepts/How We Curate.md`
(the L0–L4 funnel — apply it before treating anything as knowledge).
Reviewed notes sync into the app's retrieval layer with
`python3 tools/vault2mind.py` (dry-run; add `--apply` to push; commit
`tools/mind-sync-state.json` afterwards). Client-specific notes declare
`client: <id>` frontmatter; the default namespace is `cmm`. In-app,
Ad Lab and Studio record approved/killed verdicts to the Mind as
`kind: outcome` — wins and losses that future briefs retrieve.

## The Sentinel (rapid response — the agency's flagship loop)

`CLIENT_ISSUES` in the worker maps each client namespace to the issues they
own (mca: fuel tax credits / critical minerals / mining policy; aep: gas +
energy; vicnats: VIC election + regional; pca: housing; mba: construction;
cmm: cost of living + federal politics). Every cron tick `sentinelScan()`
counts matching stories in a 6h hot window against that issue's own 14-day
baseline from the archive; a spike (>=2.5x, >=3 stories, 12h cooldown unless
intensity grows 1.6x) fires an alert, drafts an angle with Claude grounded in
Mind retrieval, and pushes it to Slack (webhooks in KV `slack_webhooks`:
`{"mca":"https://hooks.slack…","_default":"…"}`). Rows live in `arc_alerts`
with the lifecycle stamps that measure speed to respond: detected ->
notified -> acked -> drafted. Routes: `/sentinel/alerts|scan|ack|metrics`.
In-app: the Sentinel view (nav badge counts what is unactioned) with
Acknowledge (stops the clock) and Draft in Ad Lab (seeds the brief).

## The research agent

POST `/research {q, ns?, hours?}` (key-gated, full role — it spends API
tokens): `researchRun()` plans 3-4 Google News queries with Claude, sweeps
each, reads up to 3 pages live (`pageGrab`), cross-references `arc_items`
(LIKE) and `mindRetrieve(ns||cmm)`, then synthesises a cited dossier
([W#] pages, [N#] news, [A#] archive, [S#] Mind). The run is archived as
kind `research` and logged to `mind_runs`. In-app: the Deep Research panel
on the Analyst view (query + client scope, staged progress, rendered
dossier, source list, Save to the Mind as kind `research`).

## Opposition ad monitoring (paid political persuasion)

Kinds `oppads*` in the archive hold disclosed political advertising.
`python3 tools/oppads.py all --key KEY` streams Google's political-ads
transparency bundle (public, daily), keeps the Australian rows and loads
`oppads_gadv` (advertiser lifetime AUD), `oppads_gweek` (weekly AUD spend)
and `oppads_gad` (creatives with targeting); re-runs are url-deduped. The
cron sweeps Reddit's own disclosure feed (r/RedditPoliticalAds, AU-filtered)
into kind `oppads` every tick. Map node: `x_oppads`.

## Meta, direct (no third party)

Worker secrets `META_TOKEN` (Business System User token, ads_read +
read_insights) and text var `META_AD_ACCOUNTS` (`act_123:mca,act_456:aep`)
turn on `metaInsights()`: campaign-level daily rows (spend, reach, clicks,
CTR/CPC/CPM, leads, CPL) into archive kind `campaign`, src `meta`, deduped
per campaign-day. Optional `META_USER_TOKEN` (an ID-verified user's token,
~60-day expiry) turns on `metaAdLibrary()`: AU political/issue ads matching
each `CLIENT_ISSUES` label into kind `oppads`, src `meta`, with funder,
spend band and snapshot URL. `metaCron()` runs both at most 6-hourly;
GET `/meta/status` (read) and POST `/meta/sync {since,until}` (full) for
inspection and history backfill (chunk by month).

## Access roles

Two optional worker secrets. `AXIOM_ACCESS_KEY` is a single full-access key.
`AXIOM_KEYS` is JSON of per-person keys:
`{"key1":{"n":"Heshan","r":"full"},"key2":{"n":"Steve","r":"read"}}`.
`read` may only hit read routes (`/mind/query`, `/mind/docs`,
`/archive/search`, `/sentinel/alerts`, `/sentinel/metrics`, `/session/load`);
writes return 403. The app hides mutating buttons for read-only keys.

## Security & org knowledge (Curious Minds = namespace `cmm`)

- Access control: the `AXIOM_ACCESS_KEY` worker secret gates /mind/*,
  /session/*, /log/*, /archive/search and /archive/add via the `X-Axiom-Key`
  header (open until the secret is set). `/archive/stats` stays public by
  design: aggregate counts only, so the map shows presence of knowledge
  without revealing content. The app sends the key from Settings -> Access key.
- Confidential material NEVER goes into the git vault (`knowledge/` is in the
  repo). It goes straight to the Mind (`/mind/ingest`, key-gated, R2/D1/
  Vectorize) under the owning client's namespace; the vault may hold only a
  provenance stub. Client namespaces are isolated: retrieval sees the client's
  own namespace plus `cmm`, never another client's.
- Org ingestion paths: Google Drive / Slack via this session's MCP connectors
  (operator names folders/channels; distill -> vault note or direct Mind
  ingest per confidentiality); file uploads via Ad Lab/Studio in-app; email
  as exports dropped into Drive.
- Historical series: `python3 tools/backfill.py gdelt|wiki|aec|polls|all`
  loads multi-year history (GDELT issue volume/tone, Wikipedia attention,
  AEC results CSVs, polling CSVs) into the archive as `hist_*` kinds via the
  key-gated `/archive/add`. Re-runs are safe (url-deduped).

## Working conventions

- Verify frontend changes with the Playwright harnesses in the session
  scratchpad when present; never break the Studio/Ad Lab conversation flows.
- Worker secrets (ANTHROPIC_API_KEY, GEMINI_KEY, CLICKUP_TOKEN, …) exist only
  in Cloudflare — never in the repo.
- Ship flow: commit on `claude/…` branch → push → fast-forward merge to
  `main` (GitHub Pages serves `main` **/docs**).
