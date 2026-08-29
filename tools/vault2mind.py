#!/usr/bin/env python3
"""Sync reviewed vault notes into AXIOM's The Curious Mind index.

Reads knowledge/wiki/**/*.md, routes each note to a Mind namespace from its
frontmatter (`client: mca` -> namespace mca; default `cmm`), and POSTs new or
changed notes to the worker's /mind/ingest route. Content hashes are tracked in
tools/mind-sync-state.json (committed) so unchanged notes are never re-pushed.

Dry-run by default; pass --apply to actually send. No other network egress.

Notes:
  - `mind: skip` in frontmatter excludes a note.
  - Vault meta pages (index/log/hot/overview and wiki/meta/**) never sync.
  - /mind/ingest issues a fresh docId per push, so an updated note becomes a
    new Mind document; the previous version's chunks remain until a cleanup
    route exists. The state file records superseded docIds for that day.

Usage:
  python3 tools/vault2mind.py                 # plan only
  python3 tools/vault2mind.py --apply         # push new/changed notes
  python3 tools/vault2mind.py --apply --worker https://newsaus.heshan-998.workers.dev
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VAULT = REPO / "knowledge"
STATE_PATH = REPO / "tools" / "mind-sync-state.json"
DEFAULT_WORKER = "https://newsaus.heshan-998.workers.dev"
SKIP_NAMES = {"index.md", "log.md", "hot.md", "overview.md"}


def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}, text
    meta: dict[str, str] = {}
    for line in text[4:end].splitlines():
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        if m:
            meta[m.group(1).strip()] = m.group(2).strip().strip("'\"")
    return meta, text[end + 5 :]


def collect_notes() -> list[dict]:
    notes = []
    wiki = VAULT / "wiki"
    if not wiki.is_dir():
        sys.exit(f"vault wiki not found at {wiki}")
    for p in sorted(wiki.rglob("*.md")):
        rel = p.relative_to(VAULT).as_posix()
        if p.name in SKIP_NAMES or rel.startswith("wiki/meta/") or rel.startswith("wiki/folds/"):
            continue
        raw = p.read_text(encoding="utf-8", errors="replace")
        meta, body = parse_frontmatter(raw)
        if meta.get("mind", "").lower() == "skip":
            continue
        ns = re.sub(r"[^a-z0-9_-]", "", meta.get("client", "cmm").lower()) or "cmm"
        title = meta.get("title") or p.stem
        kind = meta.get("type", "doc")
        notes.append({
            "path": rel,
            "ns": ns,
            "title": title,
            "kind": kind,
            "date": meta.get("updated") or meta.get("created") or "",
            "text": body.strip(),
            "hash": hashlib.sha256(raw.encode()).hexdigest(),
        })
    return notes


def load_state() -> dict:
    try:
        return json.loads(STATE_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return {"synced": {}}


def post_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "axiom-vault2mind/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read().decode())


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--apply", action="store_true", help="actually push (default: plan only)")
    ap.add_argument("--worker", default=DEFAULT_WORKER, help="worker base URL")
    args = ap.parse_args()

    state = load_state()
    synced = state.setdefault("synced", {})
    notes = collect_notes()
    plan = [n for n in notes if synced.get(n["path"], {}).get("hash") != n["hash"]]

    print(f"vault notes eligible: {len(notes)} | new/changed: {len(plan)}")
    for n in plan:
        prev = synced.get(n["path"])
        print(f"  {'update' if prev else 'new   '}  [{n['ns']}] {n['path']}  ({len(n['text'])} chars)")
    if not plan:
        print("nothing to sync.")
        return 0
    if not args.apply:
        print("\nplan only - re-run with --apply to push to " + args.worker)
        return 0

    failures = 0
    for n in plan:
        try:
            res = post_json(args.worker.rstrip("/") + "/mind/ingest", {
                "namespace": n["ns"], "title": n["title"], "kind": n["kind"],
                "text": n["text"], "source": "vault:" + n["path"], "date": n["date"],
            })
            if not res.get("ok"):
                raise RuntimeError(res.get("detail") or res.get("error") or "ingest failed")
            prev = synced.get(n["path"], {})
            if prev.get("docId"):
                state.setdefault("superseded", []).append(prev["docId"])
            synced[n["path"]] = {"hash": n["hash"], "docId": res.get("docId"), "ns": n["ns"]}
            print(f"  ok      [{n['ns']}] {n['path']} -> {res.get('docId')} ({res.get('chunks')} chunks)")
        except Exception as exc:  # noqa: BLE001 - report and continue per note
            failures += 1
            print(f"  FAILED  [{n['ns']}] {n['path']} - {exc}")

    STATE_PATH.write_text(json.dumps(state, indent=1, sort_keys=True) + "\n")
    print(f"\nstate written to {STATE_PATH.relative_to(REPO)} - commit it so re-syncs stay incremental.")
    if failures:
        print(f"{failures} note(s) failed; re-run --apply to retry them.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
