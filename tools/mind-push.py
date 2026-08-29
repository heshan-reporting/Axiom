#!/usr/bin/env python3
"""Push confidential staged notes straight into The Curious Mind (never git).

Confidential org/client knowledge must not enter the repo (GitHub Pages serves
it publicly). Instead: write notes as .md files with frontmatter into a local
staging folder, then push them to the key-gated /mind/ingest route.

Note format (frontmatter + body):
  ---
  namespace: mca        # client id, or cmm for agency-wide
  title: MCA Operations Intelligence - August 2026
  kind: ops             # ops | style | voice | policy | outcome | doc ...
  source: slack:#minerals-council
  date: 2026-08-29
  ---
  body text...

Usage:
  python3 tools/mind-push.py /path/to/staging-folder --key YOUR_ACCESS_KEY
  python3 tools/mind-push.py note.md --key ... --worker https://...
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import urllib.request

DEFAULT_WORKER = "https://newsaus.heshan-998.workers.dev"


def parse_note(path: pathlib.Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---\n", 4)
    if end < 0:
        return None, text
    meta = {}
    for line in text[4:end].splitlines():
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        if m:
            meta[m.group(1)] = m.group(2).strip().strip("'\"")
    return meta, text[end + 5:].strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("target", help=".md file or folder of .md notes")
    ap.add_argument("--worker", default=DEFAULT_WORKER)
    ap.add_argument("--key", required=True, help="AXIOM access key")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    p = pathlib.Path(args.target)
    files = sorted(p.glob("*.md")) if p.is_dir() else [p]
    if not files:
        sys.exit("no .md notes found")
    fails = 0
    for f in files:
        meta, body = parse_note(f)
        if not meta or not body:
            print(f"  skip    {f.name} (no frontmatter/body)")
            continue
        payload = {
            "namespace": meta.get("namespace", "cmm"),
            "title": meta.get("title", f.stem),
            "kind": meta.get("kind", "doc"),
            "text": body,
            "source": meta.get("source", "staged:" + f.name),
            "date": meta.get("date", ""),
        }
        if args.dry_run:
            print(f"  plan    [{payload['namespace']}] {f.name} ({len(body)} chars)")
            continue
        try:
            req = urllib.request.Request(
                args.worker.rstrip("/") + "/mind/ingest",
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json", "X-Axiom-Key": args.key,
                         "User-Agent": "axiom-mind-push/1.0"},
                method="POST")
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.loads(r.read().decode())
            if not d.get("ok"):
                raise RuntimeError(d.get("detail") or d.get("error") or "ingest refused")
            print(f"  ok      [{payload['namespace']}] {f.name} -> {d.get('docId')} ({d.get('chunks')} chunks)")
        except Exception as exc:
            fails += 1
            print(f"  FAILED  {f.name} - {exc}")
    if fails:
        print(f"{fails} note(s) failed - re-run to retry (server dedupes nothing; avoid double-pushing successes).")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
