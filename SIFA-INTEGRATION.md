# SIFA and AXIOM: the keyword research contract

SIFA sends keywords and topics. AXIOM researches each one across news, government
and party statements, Hansard, MPs' own social accounts, Reddit and its own
archive, writes a cited brief, and hands everything back. This page is for the
developers on both sides.

Base URL: `https://newsaus.heshan-998.workers.dev`

## Authentication

Two keys, in two directions. Neither is ever the same string as the other.

| Direction | Header | Who holds it |
|---|---|---|
| AXIOM pulls from SIFA (`GET https://sifa.wearecuriousminds.com/api/keywords`) | `Authorization: Bearer <SIFA's token>` | Stored on the worker as the secret `SIFA_TOKEN` |
| SIFA calls AXIOM (`/sifa/*`) | `Authorization: Bearer <AXIOM's inbound key>` | Minted by Curious Minds, stored as the secret `SIFA_INBOUND_KEY`, given to SIFA once |

Rotate either by setting the new value on the worker (`npx wrangler secret put
SIFA_INBOUND_KEY --name newsaus`) and on SIFA's side. Requests without a valid
bearer get `401`. If the inbound key is not set yet, `/sifa/*` answers `503
inbound_not_configured`.

## The keyword list AXIOM reads

`GET /api/keywords` on SIFA may return any of these shapes; AXIOM reads them all:

```json
["critical minerals", "fuel tax credit"]
```
```json
{"data": [{"id": 12, "keyword": "critical minerals", "topic": "resources", "client": "mca", "priority": 2}]}
```

Field names read, first match wins: `keyword|term|name|title|q|text|value`;
`topic|category|group|theme|type`; `client|ns|namespace` (the AXIOM client
namespace: `mca`, `aep`, `vicnats`, `pca`, `mba`, `pharm`, `cmm`); `id|slug|key`;
`priority|weight|rank`. Unknown fields are kept verbatim on the topic record.

AXIOM pulls this list once an hour. Every active keyword is researched at least
every six hours, two per cron tick, highest priority first.

## Pushing keywords instead

```
POST /sifa/keywords
Authorization: Bearer <inbound key>
Content-Type: application/json

{"keywords": [{"keyword": "critical minerals strategic reserve", "topic": "resources", "client": "mca"}]}
```

Answer: `{"ok": true, "received": 1, "added": 1, "updated": 0, "active": 14, "keywords": [{"id": "...", "keyword": "...", "topic": "...", "client": "mca"}]}`.
Re-sending a keyword updates it; it never duplicates.

## Asking for a fresh run

```
POST /sifa/run
{"keyword": "critical minerals strategic reserve", "client": "mca", "hours": 168}
```

Answer: `{"ok": true, "job": "j...", "keyword": "...", "poll": "/sifa/results?keyword=..."}`.
A run takes one to three minutes in the worker. The X part (MPs' own accounts)
runs on a Curious Minds collector and lands a few minutes later.

## Reading results

`GET /sifa/topics` lists every keyword with `lastRun`, `hits` and its results URL.

`GET /sifa/results?keyword=<keyword>&days=30` returns:

```json
{
  "ok": true,
  "topic": {"id": "critical-minerals-strategic-reserve", "keyword": "...", "ns": "mca", "last_run": 1789600000000},
  "brief": {
    "at": 1789600000000, "hours": 168,
    "brief": {
      "summary": "...", "volume": "...",
      "positions": [{"who": "Madeleine King", "role": "Minister for Resources, Labor", "stance": "...", "evidence": "...", "source": "[N3]"}],
      "coverage": [{"outlet": "AFR", "angle": "...", "source": "[N1]"}],
      "statements": [{"who": "...", "what": "...", "source": "[G1]"}],
      "changes": ["..."], "risks": ["..."], "openings": ["..."], "watch": ["..."], "gaps": ["..."]
    },
    "sources": [{"id": "N1", "title": "...", "url": "https://...", "origin": "news: AFR"}]
  },
  "news": [{"title": "...", "url": "...", "ts": 1789590000000, "outlet": "The Australian", "tone": 0}],
  "statements": [{"title": "...", "url": "https://minister.gov.au/...", "outlet": "..."}],
  "hansard": [{"title": "Speaker (Party): ...", "url": "...", "mp": {"name": "...", "party": "...", "house": "senate"}, "excerpt": "..."}],
  "x": [{"title": "Peter Dutton: ...", "url": "https://x.com/i/web/status/...", "mp": {"name": "Peter Dutton", "party": "Liberal", "house": "representatives"}, "comments": 212, "score": 1500, "tone": 0}],
  "reddit": [{"title": "...", "url": "...", "sub": "AustralianPolitics", "comments": 88, "tone": -1}],
  "comments": [{"platform": "x", "n": 340, "hostile": 120, "supportive": 60}, {"platform": "reddit", "n": 90, "hostile": 20, "supportive": 15}],
  "jobs": [{"id": "j...", "source": "x", "status": "done", "agent": "192"}]
}
```

Source id prefixes in the brief: `W` a page read in full, `N` news, `G`
government or party statement, `H` Hansard, `A` the AXIOM archive, `S` the
client knowledge base. Every claim in the brief carries one.

`tone` is -1 hostile, 0 neutral, 1 supportive, from a colloquial Australian
lexicon; it is a signal, not a poll.

## What is and is not collected

- News: Google News for Australia, the keyword alone, the keyword with
  MP/minister/opposition, and the keyword on `pm.gov.au`, ministers' sites,
  `aph.gov.au` and the party sites.
- Parliament: Hansard through OpenAustralia when the worker holds a key.
- MPs on X: every sitting member and senator with an X account in Wikidata;
  the keyword searched restricted to those accounts, replies read. MPs are
  named; the people replying are not.
- Reddit: the keyword across all of Reddit, Australian threads kept, comments
  read with tone.
- Facebook and Instagram pages of MPs: not readable through Meta's API without
  Page Public Content Access. The register records the page ids so this can be
  switched on if that access is granted. MPs' paid Meta advertising is
  available through the Ad Library path already in AXIOM.
- LinkedIn: no public API for other organisations' pages; not collected.

## Errors

| Status | Meaning |
|---|---|
| 400 `missing_keyword` / `no_keywords` | the body had nothing usable |
| 401 `unauthorized` | bearer missing or wrong |
| 404 `unknown_topic` | nothing on file under that keyword yet |
| 503 `inbound_not_configured` | AXIOM has no inbound key set yet |
