#!/usr/bin/env python3
"""The Creative Studio test kit: a safe place for testers to work, and a way to clear it afterwards.

  python3 tools/studio-test-kit.py seed  --key $AXIOM_KEY            # shows what it would write; nothing is sent
  python3 tools/studio-test-kit.py seed  --key $AXIOM_KEY --apply    # writes the synthetic client and two test projects
  python3 tools/studio-test-kit.py reset --key $AXIOM_KEY            # lists the test projects it would archive
  python3 tools/studio-test-kit.py reset --key $AXIOM_KEY --apply    # archives them (never deletes), each named

The synthetic client is "Harbourline Ferries - SYNTHETIC DEMO CLIENT" in the namespace synthdemo, the one tools/studio-demo.py
uses. Its kit, facts and marks are invented here (the logo and wordmark are plain drawn PNGs); no model call is made and no live
client is touched. Projects made in synthdemo, or by a guest link, are test projects: nothing they decide is filed in a client's
memory and they are left out of the outcome metrics. Use --ns for another test namespace listed in the worker's STUDIO_TEST_NS.
"""
import argparse, base64, json, os, struct, sys, urllib.error, urllib.request, zlib

WORKER = 'https://newsaus.heshan-998.workers.dev'
KIT = {
    'name': 'Harbourline Ferries - SYNTHETIC DEMO CLIENT',
    'palette': {'primary': '#0B4F6C', 'secondary': '#F2A541', 'bg': '#F7F4EE', 'text': '#13232F'},
    'fonts': {'display': 'Manrope', 'body': 'DM Sans'},
    'voice': 'Plain, warm and local: a ferry operator talking to the people who ride it. Short sentences, concrete times and places.',
    'rules': 'Never promise a timetable change before it is announced. Always name the wharf.',
    'campaigns': [
        {'id': 'harbour', 'name': 'Harbour crossings', 'logoPolicy': 'logo', 'cta': 'Plan your crossing', 'signoff': 'Harbourline Ferries', 'url': 'https://example.org/harbourline',
         'tone': 'calm, practical', 'notes': 'SYNTHETIC: invented for testing the Studio.'},
        {'id': 'nightboat', 'name': 'Night boat', 'logoPolicy': 'wordmark', 'cta': 'Ride the night boat', 'url': 'https://example.org/nightboat',
         'tone': 'lively', 'notes': 'SYNTHETIC: carries its own wordmark, never the Harbourline logo.'},
    ],
    'facts': [
        {'text': 'Harbourline runs 42 crossings a day', 'source': 'synthetic fact sheet', 'status': 'approved', 'campaign': 'harbour'},
        {'text': 'The night boat leaves Pier 3 at 9.40pm', 'source': 'synthetic timetable', 'status': 'approved', 'campaign': 'nightboat'},
        {'text': 'A draft figure nobody approved: 99 crossings', 'source': 'draft', 'status': 'pending', 'campaign': 'harbour'},
    ],
    'banned': [{'term': 'cheap', 'use': 'good value', 'why': 'the brand never says cheap', 'allowNegated': True}],
}
PROJECTS = [
    {'title': 'TEST - harbour crossings tile', 'campaign': 'harbour',
     'brief': {'objective': 'Tell riders the extra morning crossings start Monday', 'message': 'Two more morning crossings from Monday',
               'audience': 'Daily commuters', 'action': 'Plan your crossing', 'channels': ['facebook', 'instagram'], 'deliverable': 'set', 'campaignConfirmed': True}},
    {'title': 'TEST - night boat copy only', 'campaign': 'nightboat',
     'brief': {'objective': 'Remind people the night boat runs on Fridays', 'message': 'The night boat leaves Pier 3 at 9.40pm',
               'audience': 'Friday night crowd', 'action': 'Ride the night boat', 'channels': ['instagram'], 'deliverable': 'copy', 'campaignConfirmed': True}},
]


def png(w, h, rgb):
    """A plain one-colour PNG, drawn here (no image library needed)."""
    row = b'\x00' + bytes(rgb) * w
    raw = row * h
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def api(worker, key, method, path, body=None):
    req = urllib.request.Request(worker.rstrip('/') + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': 'axiom-studio-test-kit'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or '{}')
        except Exception:
            return e.code, {}


def plan_seed(ns):
    logo = base64.b64encode(png(320, 120, (11, 79, 108))).decode()
    mark = base64.b64encode(png(400, 100, (242, 165, 65))).decode()
    steps = [('POST', '/brand/kit', dict(KIT, ns=ns), 'the synthetic kit: voice, 2 campaigns, 3 facts (1 pending), 1 banned term'),
             ('POST', '/brand/kit', {'ns': ns, 'logoB64': logo, 'logoMime': 'image/png'}, 'the Harbourline logo (a plain drawn PNG)'),
             ('POST', '/brand/kit', {'ns': ns, 'wordmarkCampaign': 'nightboat', 'wordmarkB64': mark, 'wordmarkMime': 'image/png', 'logoPolicy': 'wordmark'}, 'the night boat wordmark (a plain drawn PNG)')]
    for p in PROJECTS:
        steps.append(('POST', '/studio/project', dict(p, ns=ns, test=True, idem='testkit:' + ns + ':' + p['title']), 'test project "' + p['title'] + '"'))
    return steps


def main(argv=None):
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('action', choices=['seed', 'reset'])
    a.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''), help='a full key (or set AXIOM_KEY)')
    a.add_argument('--worker', default=os.environ.get('AXIOM_WORKER', WORKER))
    a.add_argument('--ns', default='synthdemo', help='a test namespace (synthdemo, or one listed in the worker\'s STUDIO_TEST_NS)')
    a.add_argument('--apply', action='store_true', help='send it; without this nothing is written')
    o = a.parse_args(argv)
    if not o.key:
        sys.exit('A full key is needed: --key or AXIOM_KEY.')
    if o.ns in ('mca', 'aep', 'vicnats', 'pca', 'mba', 'pharm', 'guns', 'cmm'):
        sys.exit('%s is a live client. The test kit only writes to test namespaces (synthdemo, or one in STUDIO_TEST_NS).' % o.ns)
    if o.action == 'seed':
        steps = plan_seed(o.ns)
        for m, path, body, what in steps:
            print(('send ' if o.apply else 'would send ') + m + ' ' + path + ': ' + what)
        if not o.apply:
            print('Nothing was sent. Add --apply to write it.')
            return 0
        for m, path, body, what in steps:
            st, d = api(o.worker, o.key, m, path, body)
            if st >= 300:
                sys.exit('stopped at "%s": HTTP %s %s' % (what, st, json.dumps(d)[:300]))
            if path == '/studio/project':
                print('  project %s%s' % (d.get('id'), ' (already there)' if d.get('existing') else ''))
        print('Seeded %s. Testers pick "%s" as the client.' % (o.ns, KIT['name']))
        return 0
    st, d = api(o.worker, o.key, 'GET', '/studio/list?ns=%s&tests=only' % o.ns)
    if st >= 300:
        sys.exit('could not list: HTTP %s %s' % (st, json.dumps(d)[:300]))
    names = [p.get('title') for p in d.get('projects') or []]
    print('%d test project%s in %s: %s' % (len(names), '' if len(names) == 1 else 's', o.ns, ', '.join(names) or 'none'))
    if not o.apply:
        print('Nothing was archived. Add --apply to archive them (they are archived, never deleted).')
        return 0
    st, d = api(o.worker, o.key, 'POST', '/studio/project/archive-tests', {'ns': o.ns})
    if st >= 300:
        sys.exit('not archived: HTTP %s %s' % (st, json.dumps(d)[:300]))
    for p in d.get('archived') or []:
        print('  archived %s  %s' % (p.get('id'), p.get('title')))
    return 0


if __name__ == '__main__':
    sys.exit(main())
