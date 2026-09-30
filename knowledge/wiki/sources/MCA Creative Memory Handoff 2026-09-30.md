---
type: source
title: MCA Creative Memory Handoff 2026-09-30
status: stub
created: 2026-09-30
updated: 2026-09-30
client: mca
tags:
  - source
  - provenance-stub
  - creative
  - mca
---

# MCA Creative Memory Handoff 2026-09-30

Provenance stub only. The content is confidential client material and lives
in the Mind, not in this vault.

## What it is

A portable creative-memory handoff for the Minerals Council of Australia,
reviewed 30 September 2026, covering three campaigns kept as separate
identities: Australian mining / 1.5, Hands Off Our Fuel, and Victoria's
Golden Opportunity. It distinguishes explicit client requirements from
observed visual conventions, conditional proposals, approval snapshots and
recommended working practice, and carries four evidence appendices (live
reviewer comments, the myth-busting workbook, the Victoria calendar, the
December-versus-February comparison deck).

## Scope

Creative work only: the Content Desk, the Release Desk, Ad Lab and Studio.
It is not a source for the newsroom, the Sentinel, narratives, sentiment,
topic research, the research agent or the daily brief.

## Where it lives

- Mind namespace `mca_creative` (the creative shelf, retrieved only by the
  four creative surfaces alongside `mca` and `cmm`): eight documents of kind
  `brief` (the three campaign identity documents tagged `national`, `hoof`,
  `vgo`; the rest untagged) and four of kind `doc` (the appendices, whole,
  not split by campaign), filed with `tools/engine-ingest.py --mind-ns
  mca_creative` from the `mca-creative-memory` pack; sources carry the
  `pack:mca_creative:...` tag.
- Engine rules: 27 standing corrections in `engine_fixes` for namespace
  `mca`, source `creative-memory:2026-09-30`, tasks `copy` and `tiles` only.
  Listed and switchable in the Content Desk and Release Desk Learned panels.

## How to use it in a session

The Content Desk and Release Desk retrieve it on every build; Studio and Ad
Lab through `POST /mind/query {namespace:'mca', creative:true, q:...}`. When
briefing Claude directly on MCA creative, hand over the handoff file itself;
this stub only records that it exists and where it was filed.

## Update rule

New client feedback is added to the pack with its source, date, campaign and
status, then re-ingested; earlier documents stay in the Mind, so decisions
are not lost. Retired rules are switched off, not deleted.
