#!/usr/bin/env python3
"""Report exactly what the live worker holds for a client's campaign identities. Read-only: nothing is changed.

For each campaign in the brand kit: the mark policy (client logo, campaign wordmark, both or none), whether the logo
and the wordmark are actually in R2 (not just what the kit says), the Studio references filed for it by purpose,
where approved references show the mark (observed, never invented), the learned tile preferences that apply to it,
the catalogued artworks, and the gaps that will make compositions incomplete or leave the art director guessing.

  python3 tools/studio-identity.py --ns mca --key $AXIOM_KEY
  python3 tools/studio-identity.py --ns mca --key $AXIOM_KEY --json      # the raw answer

Uses GET /studio/identity?ns= (read role).
"""
import argparse, json, sys, urllib.request, urllib.error

DEFAULT_WORKER = 'https://newsaus.heshan-998.workers.dev'


def get(base, key, path):
    req = urllib.request.Request(base + path, headers={'X-Axiom-Key': key, 'User-Agent': 'axiom-studio-identity/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors='replace')
        try:
            d = json.loads(raw or '{}')
        except Exception:
            d = {}
        raise SystemExit('GET %s -> HTTP %s %s' % (path, e.code, (d.get('error', '') + ' ' + d.get('detail', '')).strip() or raw[:160] or '(empty: Cloudflare refused the request before the worker saw it)'))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--ns', required=True); ap.add_argument('--key', required=True); ap.add_argument('--worker', default=DEFAULT_WORKER); ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    d = get(a.worker.rstrip('/'), a.key, '/studio/identity?ns=' + a.ns)
    if a.json:
        print(json.dumps(d, indent=2)); return
    k = d.get('kit') or {}
    logo = k.get('logo') or {}
    print('%s: %s; client logo %s' % (a.ns, k.get('name') or 'no kit', ('on file (%s, %d KB)' % (logo.get('mime'), logo.get('bytes', 0) // 1024)) if logo.get('onFile') else 'NOT on file' + (' (the kit says it is, R2 has no object)' if logo.get('kitSays') else '')))
    for c in d.get('campaigns') or []:
        wm = c.get('wordmark') or {}
        print('\n  %s (%s)%s' % (c['name'], c['id'], '' if c.get('active', True) else ' - inactive'))
        print('    mark policy: %s' % c['policy'])
        if c['policy'] in ('wordmark', 'both'):
            print('    wordmark: %s' % (('on file (%s, %d KB)' % (wm.get('mime'), wm.get('bytes', 0) // 1024)) if wm.get('onFile') else 'NOT on file' + (' (the kit says it is, R2 has no object)' if wm.get('kitSays') else '')))
        if c.get('identity'):
            print('    identity: %s' % c['identity'])
        refs = c.get('references') or {}
        print('    references: %d (%s), %d analysed' % (refs.get('total', 0), ', '.join('%s %d' % (p, n) for p, n in (refs.get('byPurpose') or {}).items()) or 'none', refs.get('analysed', 0)))
        pl = c.get('placement') or {}
        print('    mark placement: %s' % (pl.get('text') if pl.get('basis') == 'observed' else 'not observed in any approved reference; the house default (bottom right) applies'))
        prefs = c.get('preferences') or []
        print('    recorded tile preferences: %d%s' % (len(prefs), ''.join('\n      - %s (%s)' % (p['rule'], p['scope']) for p in prefs[:8])))
        print('    catalogued artworks for this campaign: %d' % c.get('artworks', 0))
        for g in c.get('gaps') or []:
            print('    GAP: %s' % g)
    r = d.get('references') or {}
    print('\n  references across projects: %d (%d not assigned to a campaign); recorded preferences %d; artworks %d' % (r.get('total', 0), r.get('unassigned', 0), d.get('preferences', 0), d.get('artworks', 0)))
    print('\n' + (d.get('note') or ''))


if __name__ == '__main__':
    main()
