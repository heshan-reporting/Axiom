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

Stdlib only. Posts in batches of 150 (the server's per-call cap). After each
kind it reads the worker's public /archive/stats back and prints how many rows
of that kind the database now holds, so "pushed" always means "landed".
Exits non-zero if the archive did not grow and the rows were not already there.
"""
import argparse, json, os, sys, time, urllib.request

WORKER = 'https://newsaus.heshan-998.workers.dev'


def get_json(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': 'axiom-archive-push/1.1'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or '{}')


def kind_count(worker, kind):
    """Rows of this kind in the worker's database, via the public stats route."""
    try:
        return int((get_json(worker.rstrip('/') + '/archive/stats').get('byKind') or {}).get(kind, 0))
    except Exception as e:
        print('  (could not read /archive/stats: %s)' % e, file=sys.stderr)
        return None


def post(worker, key, kind, rows, dry):
    added = 0; last_total = None; quiet_batches = 0
    for i in range(0, len(rows), 150):
        batch = rows[i:i + 150]
        if dry:
            added += len(batch); continue
        req = urllib.request.Request(worker.rstrip('/') + '/archive/add', method='POST',
                                     data=json.dumps({'kind': kind, 'rows': batch}).encode(),
                                     headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': 'axiom-archive-push/1.1'})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    d = json.loads(r.read().decode() or '{}')
                if d.get('error'):
                    sys.exit('server refused: %s %s' % (d.get('error'), d.get('detail', '')))
                n = int(d.get('added', 0)); added += n
                if 'total' in d: last_total = int(d['total'])
                if n == 0 and batch: quiet_batches += 1
                break
            except urllib.error.HTTPError as e:
                sys.exit('HTTP %s from %s - %s' % (e.code, worker, e.read().decode()[:200]))
            except Exception as e:
                if attempt == 3:
                    print('  batch failed:', e, file=sys.stderr)
                else:
                    time.sleep(2 ** attempt)
        if (i // 150) % 20 == 19:
            print('  %s: %d/%d sent%s' % (kind, i + len(batch), len(rows), (' - archive holds %d' % last_total) if last_total is not None else ''))
    return added, last_total, quiet_batches


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
    total = 0; problems = []
    print('worker: %s' % a.worker)
    for b in batches:
        kind, rows = b['kind'], b.get('rows', [])
        before = None if a.dry_run else kind_count(a.worker, kind)
        n, srv_total, quiet = post(a.worker, a.key, kind, rows, a.dry_run)
        if a.dry_run:
            print('would push %s: %d rows' % (kind, n)); total += n; continue
        after = kind_count(a.worker, kind)
        if after is None and srv_total is not None: after = srv_total
        grew = (after - before) if (after is not None and before is not None) else None
        line = 'pushed %s: %d rows written' % (kind, n)
        if after is not None: line += ' - archive now holds %d %s rows' % (after, kind)
        if grew is not None: line += ' (%+d)' % grew
        print(line)
        total += n
        if rows and after is not None and grew is not None and grew == 0:
            if before >= len(rows) * 0.9:
                print('  (nothing new: these %s rows were already in the archive)' % kind)
            else:
                problems.append('%s: sent %d rows but the archive still holds %d. The worker accepted the POSTs without keeping the rows - '
                                'check Cloudflare -> newsaus -> Settings -> Bindings -> MIND_DB points at the intended D1 database, '
                                'and D1 -> that database -> Metrics for write errors or a hit daily write limit.' % (kind, len(rows), after))
        elif rows and after is not None and after < len(rows) * 0.5 and grew is not None and grew < len(rows) * 0.5:
            problems.append('%s: only %+d rows landed of %d sent - re-run once; if it does not grow, see the worker\'s D1 metrics.' % (kind, grew, len(rows)))
    print('done: %d rows %s' % (total, 'counted' if a.dry_run else 'archived'))
    if problems:
        print('\nPROBLEM: rows did not land\n  ' + '\n  '.join(problems), file=sys.stderr)
        sys.exit(2)


if __name__ == '__main__':
    main()
