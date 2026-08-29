---
type: concept
title: How We Curate
status: evergreen
created: 2026-08-29
updated: 2026-08-29
tags:
  - concept
  - doctrine
  - curation
client: cmm
---

# How We Curate

The editorial intake doctrine for the AXIOM knowledge vault. Every future
session applies these gates before anything is treated as knowledge. The
firehose informs; only curated, cited material is believed.

## The funnel

- **L0 — Firehose (never ingested wholesale).** AXIOM's 66 feeds, social
  networks, and forums are perception, not memory. They live in the app only.
- **L1 — Candidates (machine-scored).** Material may be considered for
  ingestion when it clears at least one structural signal: cross-outlet
  corroboration (two or more outlets on the same story), a Priority Desk
  flag, a saved-monitor hit, or a baseline anomaly. Single-outlet,
  uncorroborated items do not qualify.
- **L2 — Captured (cited, not yet believed).** Ingestion goes through
  `/wiki-ingest` with a source-ledger entry: authority tier, date, and
  extracted claims marked supported, contradicted, or unreviewed. Forum and
  social material enters only as sentiment evidence, never as fact.
- **L3 — Knowledge (human-gated).** Only reviewed notes are linked into the
  index and Maps of Content. This gate is never automated.
- **L4 — Distilled intelligence.** Playbooks, narrative maps, and win/loss
  outcome notes synthesized from L3. These are what the engine consumes.

## Noise controls

- Authority tiers: wire/masthead > specialist/policy > advocacy > social/forum.
- Corroboration threshold before a factual claim can be `accepted`.
- Freshness: time-sensitive claims carry dates and age out of [[hot]].
- Hygiene: run wiki-lint weekly; fold the log when it grows; orphaned notes
  are candidates for review or removal.

## How the engine learns

Model weights are never trained on this material. The engine grows through:

1. Retrieval grounding — reviewed notes sync to The Curious Mind
   (`tools/vault2mind.py`), and every AI surface retrieves from it.
2. Distilled playbooks — periodic L4 syntheses injected into briefs.
3. Outcome feedback — approved/killed verdicts from Ad Lab and Studio are
   recorded as outcome notes and inform future generations.

Client-specific notes declare `client: <id>` in frontmatter (for example
`client: mca`); everything else syncs to the shared `cmm` namespace.
