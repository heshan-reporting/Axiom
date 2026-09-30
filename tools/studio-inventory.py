#!/usr/bin/env python3
"""
studio-inventory.py - the migration inventory for the Creative Studio.

Counts the legacy creative work the Studio will adopt, per client namespace,
through the worker's existing read routes, without changing anything:

  release packs   GET /release/list?ns=   (status, tiles, rendered images)
  content sets    GET /content/list?ns=   (status, pieces)

Studio and Ad Lab sessions live in KV under browser-held ids (imgsess_<id>);
the worker has no route that lists them yet, so they cannot be counted from
here. Phase 1 adds GET /studio/inventory, which lists them server-side with
whatever client ownership their documents record. This tool says so instead
of guessing.

Usage:
  python3 tools/studio-inventory.py --key KEY [--ns mca,aep] [--json out.json]
"""
import argparse, json, os, sys, urllib.error, urllib.request

WORKER = 'https://newsaus.heshan-998.workers.dev'
NS = ['mca', 'aep', 'vicnats', 'pca', 'mba', 'pharm', 'cmm']


def get(worker, key, path):
    req = urllib.request.Request(worker.rstrip('/') + path, headers={'X-Axiom-Key': key, 'User-Agent': 'axiom-studio-inventory/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode() or '{}')
        except Exception:
            return {'error': 'HTTP %s' % e.code}
    except Exception as e:
        return {'error': str(e)[:160]}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--worker', default=os.environ.get('AXIOM_WORKER', WORKER))
    ap.add_argument('--ns', default=','.join(NS), help='client namespaces to count, comma-separated')
    ap.add_argument('--json', default='', help='also write the inventory to this file')
    a = ap.parse_args(argv)
    if not a.key:
        sys.exit('give --key or set AXIOM_KEY')
    out = {'worker': a.worker, 'namespaces': {}, 'notes': []}
    total_packs = total_sets = 0
    print('%-10s %-14s %-14s %s' % ('client', 'release packs', 'content sets', 'detail'))
    for ns in [x.strip() for x in a.ns.split(',') if x.strip()]:
        packs = get(a.worker, a.key, '/release/list?ns=%s' % ns)
        sets = get(a.worker, a.key, '/content/list?ns=%s' % ns)
        pl = packs.get('packs') or packs.get('items') or []
        sl = sets.get('sets') or sets.get('items') or []
        by = lambda rows: {s: sum(1 for r in rows if (r.get('status') or '') == s) for s in sorted(set((r.get('status') or '') for r in rows))}
        rendered = sum(1 for r in pl if (r.get('status') or '') == 'rendered')
        detail = []
        if packs.get('error'):
            detail.append('release: %s' % (packs.get('detail') or packs.get('error')))
        if sets.get('error'):
            detail.append('content: %s' % (sets.get('detail') or sets.get('error')))
        if pl:
            detail.append('packs by status %s' % by(pl))
        if sl:
            detail.append('sets by status %s' % by(sl))
        print('%-10s %-14d %-14d %s' % (ns, len(pl), len(sl), '; '.join(detail) or '-'))
        out['namespaces'][ns] = {'release_packs': len(pl), 'release_rendered': rendered, 'content_sets': len(sl), 'packs_by_status': by(pl) if pl else {}, 'sets_by_status': by(sl) if sl else {}, 'errors': [d for d in detail if ': ' in d and ('release:' in d or 'content:' in d)]}
        total_packs += len(pl); total_sets += len(sl)
    print('%-10s %-14d %-14d' % ('total', total_packs, total_sets))
    note = 'Studio and Ad Lab sessions (KV imgsess_*) are not countable through the current routes; Phase 1 adds GET /studio/inventory. Sessions expire 30 days after their last write.'
    print(note)
    out['notes'].append(note)
    if a.json:
        with open(a.json, 'w') as f:
            json.dump(out, f, indent=1)
        print('written ' + a.json)


if __name__ == '__main__':
    main()
