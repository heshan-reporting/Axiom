#!/usr/bin/env python3
"""
archive-push.py - load any prepared rows file into AXIOM's permanent archive.

Input: a JSON file shaped either
  {"kind": "campaign", "rows": [ {...}, ... ]}
or
  {"batches": [ {"kind": "campaign", "rows": [...]}, {"kind": "oppads", "rows": [...]} ]}

Each row: {src, title, body?, url, author?, tone?, meta?, ts}. Rows are
url-deduped server-side (kind + url), so re-pushing is safe.

Usage:
  python3 tools/archive-push.py rows.json --key KEY [--worker URL] [--dry-run]
  AXIOM_KEY=... python3 tools/archive-push.py rows.json

Stdlib only. Posts in batches of 150 (the server's per-call cap).
"""
import argparse, json, os, sys, time, urllib.request

WORKER = 'https://newsaus.heshan-998.workers.dev'


def post(worker, key, kind, rows, dry):
    added = 0
    for i in range(0, len(rows), 150):
        batch = rows[i:i + 150]
        if dry:
            added += len(batch); continue
        req = urllib.request.Request(worker.rstrip('/') + '/archive/add', method='POST',
                                     data=json.dumps({'kind': kind, 'rows': batch}).encode(),
                                     headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': 'axiom-archive-push/1.0'})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    d = json.loads(r.read().decode() or '{}')
                if d.get('error'):
                    sys.exit('server refused: %s %s' % (d.get('error'), d.get('detail', '')))
                added += d.get('added', 0)
                break
            except urllib.error.HTTPError as e:
                sys.exit('HTTP %s from %s - %s' % (e.code, worker, e.read().decode()[:200]))
            except Exception as e:
                if attempt == 3:
                    print('  batch failed:', e, file=sys.stderr)
                else:
                    time.sleep(2 ** attempt)
    return added


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('file')
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--worker', default=WORKER)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    if not a.key and not a.dry_run:
        sys.exit('need --key or AXIOM_KEY')
    with open(a.file) as f:
        data = json.load(f)
    batches = data.get('batches') or [{'kind': data.get('kind', 'hist'), 'rows': data.get('rows', [])}]
    total = 0
    for b in batches:
        n = post(a.worker, a.key, b['kind'], b.get('rows', []), a.dry_run)
        print('%s %s: %d rows' % ('would push' if a.dry_run else 'pushed', b['kind'], n))
        total += n
    print('done: %d rows %s' % (total, 'counted' if a.dry_run else 'archived'))


if __name__ == '__main__':
    main()
