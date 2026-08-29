---
type: concept
title: Client Playbook Template
status: evergreen
created: 2026-08-29
updated: 2026-08-29
tags:
  - concept
  - template
  - playbook
client: cmm
mind: skip
---

# Client Playbook Template

Copy this structure into one or more notes per client. Playbook notes are the
standing rules the engine applies to EVERY generation for that client - the
Studio, the Ad Lab and the Composer all load them automatically.

Split large playbooks into one note per `type` so each stays sharp. The three
playbook types are `style`, `voice`, and `policy`; anything else is ordinary
knowledge. Sync with `tools/vault2mind.py --apply` after saving, or paste
directly into The Curious Mind tab in-app with the matching kind.

## Frontmatter to use (per client note)

```
---
type: style          # style | voice | policy
title: MCA - Ad Creative Style
client: mca          # the client's namespace id
created: 2026-08-29
updated: 2026-08-29
---
```

## `type: style` - ad creative rules

Layout conventions (headline placement, logo position, clear space), palette
with hex values, typography direction, imagery rules (people or not, regional
vs metro settings, photography vs illustration), format preferences, and what
approved reference creatives to match.

## `type: voice` - wording and tone

The voice in one sentence. Words and phrases to use; words that are banned.
Sentence length and rhythm. How to talk about opponents (usually: factually,
never personally). Reading level. Australian English always.

## `type: policy` - messaging pillars

The 3-5 messages the client stands on, each with its strongest proof point.
Positions to never contradict. Mandatory lines (authorised-by, disclaimers).
Topics that require sign-off before publishing.

## Keeping playbooks honest

- Update the note, bump `updated:`, re-sync - the engine follows immediately.
- Record wins and losses in-app (Approve / Kill); outcomes retrieve alongside
  the playbook, so real results sharpen the rules over time.
- Review playbooks against [[How We Curate]] hygiene: dated, cited where they
  make factual claims, and folded when they sprawl.
