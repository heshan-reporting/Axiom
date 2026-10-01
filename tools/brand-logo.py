#!/usr/bin/env python3
"""Put a client's logo into its brand kit exactly as supplied.

The Studio places the kit logo as an exact image layer on every composition; it is never redrawn or
regenerated. This tool uploads the file you have (PNG, JPEG or WebP, up to 2 MB) to the live worker,
which stores it in R2 under brand/<ns>/logo and serves it only for that client's work.

  python3 tools/brand-logo.py path/to/logo.png --ns mca --key $AXIOM_KEY
  python3 tools/brand-logo.py --ns mca --key $AXIOM_KEY --check      # what the kit holds now

Nothing else in the kit is touched: campaigns, facts, banned terms, palette and fonts stay as they are.
"""
import argparse, base64, json, mimetypes, os, sys, urllib.request, urllib.error

DEFAULT_WORKER = 'https://newsaus.heshan-998.workers.dev'


def http(base, key, method, path, body=None):
    # Cloudflare refuses Python's default User-Agent with an empty 403, so name the tool.
    req = urllib.request.Request(base + path, method=method, headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': 'axiom-brand-logo/1.0'},
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors='replace')
        try:
            d = json.loads(raw or '{}')
        except Exception:
            d = {}
        why = (d.get('error', '') + ' ' + d.get('detail', '')).strip() or ('(no JSON body: %s)' % (raw[:160].replace('\n', ' ') or 'empty - a 403 with no body is Cloudflare refusing the request before the worker saw it'))
        raise SystemExit('%s %s -> HTTP %s %s' % (method, path, e.code, why))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('file', nargs='?'); ap.add_argument('--ns', required=True); ap.add_argument('--key', required=True)
    ap.add_argument('--worker', default=DEFAULT_WORKER); ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    base = a.worker.rstrip('/')
    if a.check or not a.file:
        k = http(base, a.key, 'GET', '/brand/kit?ns=' + a.ns)
        kit = k.get('kit') or {}
        print('%s: %s; logo %s; %d campaigns, %d facts, %d banned terms' % (a.ns, kit.get('name') or 'no kit', 'on file (' + str(kit.get('logoMime')) + ')' if k.get('hasLogo') else 'not on file', len(kit.get('campaigns') or []), len(kit.get('facts') or []), len(kit.get('banned') or [])))
        if not a.file:
            return
    if not os.path.isfile(a.file):
        raise SystemExit('not a file: ' + a.file)
    size = os.path.getsize(a.file)
    if size > 2 * 1024 * 1024:
        raise SystemExit('the logo is %d KB; the kit takes up to 2 MB' % (size // 1024))
    mime = mimetypes.guess_type(a.file)[0] or 'image/png'
    if mime not in ('image/png', 'image/jpeg', 'image/webp'):
        raise SystemExit('PNG, JPEG or WebP only (got %s)' % mime)
    with open(a.file, 'rb') as fh:
        b64 = base64.b64encode(fh.read()).decode()
    r = http(base, a.key, 'POST', '/brand/kit', {'ns': a.ns, 'logoB64': b64, 'logoMime': mime})
    print('logo stored for %s: %s, %d KB, served at %s' % (a.ns, mime, size // 1024, r.get('logoUrl', '/brand/logo?ns=' + a.ns)))
    print('every new composition for this client places it exactly, bottom right; existing versions keep their layout until re-laid out')


if __name__ == '__main__':
    main()
