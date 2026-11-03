#!/usr/bin/env python3
"""The Creative Studio test kit: a safe place for testers to work, and a way to clear it afterwards.

  python3 tools/studio-test-kit.py seed  --key $AXIOM_KEY            # shows what it would write; nothing is sent
  python3 tools/studio-test-kit.py seed  --key $AXIOM_KEY --apply    # writes the synthetic client and its test projects
  python3 tools/studio-test-kit.py seed  --key $AXIOM_KEY --apply --tester Ana   # a set of projects of Ana's own
  python3 tools/studio-test-kit.py reset --key $AXIOM_KEY            # lists the test projects it would archive
  python3 tools/studio-test-kit.py reset --key $AXIOM_KEY --apply    # archives them (never deletes), each named

The synthetic client is "Harbourline Ferries - SYNTHETIC DEMO CLIENT" in the namespace synthdemo, the one tools/studio-demo.py
uses. Its kit, facts and marks are invented here (the logo and wordmark are drawn PNGs); no model call is made and no live
client is touched. The projects are parked where the journeys start, so testing Direction, Copy, Design, Review and Deliver
costs nothing first: a brief to read (an off-topic paragraph and the unapproved "99 crossings" figure in its source), a brief
with no campaign chosen, three directions on the board, copy written from a chosen direction, a Design set with one tile laid
out to pass and one laid out to block (both measured when opened), and a Review set laid out to pass with nothing approved.
The two campaigns hold uneven material on purpose (harbour much more than nightboat) and the night boat wordmark is held
bottom right by a mandatory rule, so campaign inference and the mark rule can be tested. Nothing is ever approved by the
seed: an approval is a person's. Projects made in synthdemo, or by a guest link, are test projects: nothing they decide is filed in a client's
memory and they are left out of the outcome metrics. Use --ns for another test namespace listed in the worker's STUDIO_TEST_NS.
"""
import argparse, base64, json, os, re, struct, sys, urllib.error, urllib.request, zlib

WORKER = 'https://newsaus.heshan-998.workers.dev'
HARBOUR_SOURCE = (
    'Harbourline will add two morning crossings from Circular Wharf from Monday 3 March, at 6.10am and 6.40am.\n\n'
    'Riders asked for earlier services in last year\'s survey; the new crossings answer that.\n\n'
    'A draft note says Harbourline will soon run 99 crossings a day. That figure has not been approved.\n\n'
    'Separately, the council\'s weekend markets move to the foreshore in April, with food trucks and live music.')
KIT = {
    'name': 'Harbourline Ferries - SYNTHETIC DEMO CLIENT',
    'palette': {'primary': '#0B4F6C', 'secondary': '#F2A541', 'bg': '#F7F4EE', 'text': '#13232F'},
    'fonts': {'display': 'Manrope', 'body': 'DM Sans'},
    'voice': 'Plain, warm and local: a ferry operator talking to the people who ride it. Short sentences, concrete times and places.',
    'rules': 'Never promise a timetable change before it is announced. Always name the wharf.',
    'campaigns': [
        {'id': 'harbour', 'name': 'Harbour crossings', 'logoPolicy': 'logo', 'cta': 'Plan your crossing', 'signoff': 'Harbourline Ferries', 'url': 'https://example.org/harbourline',
         'tone': 'calm, practical', 'notes': 'SYNTHETIC: invented for testing the Studio. Holds most of the stored material on purpose.'},
        {'id': 'nightboat', 'name': 'Night boat', 'logoPolicy': 'wordmark', 'cta': 'Ride the night boat', 'url': 'https://example.org/nightboat',
         'tone': 'lively', 'notes': 'SYNTHETIC: carries its own wordmark, never the Harbourline logo.',
         'markRule': {'corner': 'br', 'mandatory': True, 'clearSpace': 0.5, 'minWidth': 8, 'note': 'SYNTHETIC: the night boat wordmark sits bottom right'}},
    ],
    'facts': [
        {'text': 'Harbourline runs 42 crossings a day', 'source': 'synthetic fact sheet', 'status': 'approved', 'campaign': 'harbour'},
        {'text': 'Two extra morning crossings start Monday 3 March', 'source': 'synthetic timetable', 'status': 'approved', 'campaign': 'harbour'},
        {'text': 'A crossing takes 12 minutes from Circular Wharf to Point Lane', 'source': 'synthetic timetable', 'status': 'approved', 'campaign': 'harbour'},
        {'text': 'Harbourline carried 1.2 million riders last year', 'source': 'synthetic annual report', 'status': 'approved', 'campaign': 'harbour'},
        {'text': 'The night boat leaves Pier 3 at 9.40pm', 'source': 'synthetic timetable', 'status': 'approved', 'campaign': 'nightboat'},
        {'text': 'A draft figure nobody approved: 99 crossings', 'source': 'draft', 'status': 'pending', 'campaign': 'harbour'},
    ],
    'banned': [{'term': 'cheap', 'use': 'good value', 'why': 'the brand never says cheap', 'allowNegated': True}],
}
HB = {'objective': 'Tell riders the extra morning crossings start Monday', 'message': 'Two more morning crossings from Monday',
      'audience': 'Daily commuters', 'action': 'Plan your crossing', 'channels': ['facebook', 'instagram'], 'deliverable': 'set', 'campaignConfirmed': True}
NB = {'objective': 'Remind people the night boat runs on Fridays', 'message': 'The night boat leaves Pier 3 at 9.40pm',
      'audience': 'Friday night crowd', 'action': 'Ride the night boat', 'channels': ['facebook', 'instagram'], 'deliverable': 'set', 'campaignConfirmed': True}
DIRS_HB = [
    {'title': 'The earlier start', 'idea': 'The first light on the water: the extra 6.10am crossing', 'headline': 'Two more morning crossings from Monday', 'message': 'Earlier crossings from Circular Wharf', 'medium': 'photo-documentary', 'composition': 'photograph full bleed, words in a panel at the foot'},
    {'title': 'The timetable itself', 'idea': 'Show the new times as the news: 6.10 and 6.40', 'headline': '6.10. 6.40. New from Monday.', 'message': 'The times are the story', 'medium': 'typographic', 'composition': 'type only on the harbour blue, the times large'},
    {'title': 'Riders asked', 'idea': 'Riders asked for earlier services; this is the answer', 'headline': 'You asked for earlier. From Monday, it is.', 'message': 'We listened to riders', 'medium': 'editorial', 'composition': 'a quote card with a small photograph beside it'},
]
COPY_HB = [('facebook', '1:1', {'headline': 'Two more morning crossings from Monday', 'support': 'New 6.10am and 6.40am services from Circular Wharf.', 'cta': 'Plan your crossing', 'caption': 'Earlier starts from Monday 3 March. Two new morning crossings leave Circular Wharf at 6.10am and 6.40am.', 'alt': 'A ferry leaving Circular Wharf at dawn'}),
           ('instagram', '4:5', {'headline': 'Earlier crossings start Monday', 'support': 'From Circular Wharf at 6.10am and 6.40am.', 'cta': 'Plan your crossing', 'caption': 'Two new morning crossings from Monday 3 March.', 'alt': 'A ferry on the harbour in morning light'})]
COPY_NB = [('facebook', '1:1', {'headline': 'The night boat runs Fridays', 'support': 'Leaves Pier 3 at 9.40pm.', 'cta': 'Ride the night boat', 'caption': 'Friday nights on the water: the night boat leaves Pier 3 at 9.40pm.', 'alt': 'The night boat lit up at Pier 3'}),
           ('instagram', '4:5', {'headline': 'Fridays, 9.40pm, Pier 3', 'support': 'The night boat is back on Friday nights.', 'cta': 'Ride the night boat', 'caption': 'The night boat leaves Pier 3 at 9.40pm every Friday.', 'alt': 'Lights on the water from the night boat'})]
# the projects, each parked where a journey starts (name, campaign, brief, what to add when the project is new)
PROJECTS = [
    {'key': 'brief', 'title': 'TEST - harbour crossings tile', 'campaign': 'harbour', 'brief': HB, 'source': HARBOUR_SOURCE},
    {'key': 'copyonly', 'title': 'TEST - night boat copy only', 'campaign': 'nightboat', 'brief': dict(NB, channels=['instagram'], deliverable='copy')},
    {'key': 'nocampaign', 'title': 'TEST - no campaign chosen yet', 'campaign': '', 'brief': dict(HB, campaignConfirmed=False), 'source': HARBOUR_SOURCE},
    {'key': 'direction', 'title': 'TEST - parked at Direction', 'campaign': 'harbour', 'brief': HB, 'directions': DIRS_HB},
    {'key': 'copy', 'title': 'TEST - parked at Copy', 'campaign': 'harbour', 'brief': HB, 'directions': DIRS_HB[:1], 'choose': True, 'assets': [('copy', c) for c in COPY_HB]},
    {'key': 'design', 'title': 'TEST - parked at Design (one passes, one blocks)', 'campaign': 'harbour', 'brief': HB, 'directions': DIRS_HB[1:2], 'choose': True,
     'reference': 'harbour', 'assets': [('pass', COPY_HB[0]), ('block', COPY_HB[1])]},
    {'key': 'review', 'title': 'TEST - parked at Review (nothing approved)', 'campaign': 'nightboat', 'brief': NB,
     'directions': [{'title': 'Friday lights', 'idea': 'The night boat as the start of a Friday night', 'headline': 'Fridays, 9.40pm, Pier 3', 'message': 'The night boat runs Fridays', 'medium': 'typographic', 'composition': 'type only, the wordmark bottom right'}],
     'choose': True, 'reference': 'nightboat', 'assets': [('pass', c) for c in COPY_NB]},
]
TESTER_RX = r'^[A-Za-z][A-Za-z0-9 ._-]{0,30}$'


def png(w, h, rgb, inner=None):
    """A drawn PNG (no image library needed): one colour, or with inner=(rgb, inset) a frame of one colour around a block
    of another, so a mark reads on both a dark and a light ground."""
    if inner is None:
        raw = (b'\x00' + bytes(rgb) * w) * h
    else:
        col, k = inner
        raw = b''
        for y in range(h):
            raw += b'\x00' + b''.join(bytes(col if (k <= x < w - k and k <= y < h - k) else rgb) for x in range(w))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def png_rgba(w, h, ink, on):
    """A transparent PNG with strokes of one colour where on(x, y) is true: drawn like a real mark file (ink on transparency)."""
    raw = b''.join(b'\x00' + b''.join(bytes(ink) + b'\xff' if on(x, y) else b'\x00\x00\x00\x00' for x in range(w)) for y in range(h))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


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


def kit_steps(ns):
    # drawn like real mark files, strokes on transparency: the logo in the kit's light colour, the wordmark in its amber; both
    # read on the kit's dark ground, where the seeded tiles put them
    logo = base64.b64encode(png_rgba(320, 120, (247, 244, 238), lambda x, y: 20 <= y < 100 and (x % 40) < 26)).decode()
    mark = base64.b64encode(png_rgba(400, 100, (242, 165, 65), lambda x, y: 15 <= y < 85 and (x % 30) < 18)).decode()
    return [('POST', '/brand/kit', dict(KIT, ns=ns), 'the synthetic kit: voice, 2 campaigns (uneven material; a mandatory wordmark rule on nightboat), 6 facts (1 pending), 1 banned term'),
            ('POST', '/brand/kit', {'ns': ns, 'logoB64': logo, 'logoMime': 'image/png'}, 'the Harbourline logo (a drawn PNG)'),
            ('POST', '/brand/kit', {'ns': ns, 'wordmarkCampaign': 'nightboat', 'wordmarkB64': mark, 'wordmarkMime': 'image/png', 'logoPolicy': 'wordmark'}, 'the night boat wordmark (a drawn PNG)')]


def project_title(p, tester):
    return p['title'].replace('TEST - ', 'TEST (%s) - ' % tester, 1) if tester else p['title']


def plan_seed(ns, tester=''):
    """What the seed would write, in words (a dry run prints this)."""
    lines = ['%s %s: %s' % (m, path, what) for m, path, _, what in kit_steps(ns)]
    for p in PROJECTS:
        parts = []
        if p.get('source'): parts.append('a source to read')
        if p.get('directions'): parts.append('%d direction%s%s' % (len(p['directions']), '' if len(p['directions']) == 1 else 's', ', one chosen' if p.get('choose') else ''))
        if p.get('reference'): parts.append('a brand reference for ' + p['reference'])
        kinds = [k for k, _ in p.get('assets', [])]
        if kinds: parts.append('%d piece%s (%s)' % (len(kinds), '' if len(kinds) == 1 else 's', ', '.join({'copy': 'copy written, imagery to come', 'pass': 'laid out to pass', 'block': 'laid out to block'}[k] for k in kinds)))
        lines.append('POST /studio/project: test project "%s" (%s)%s' % (project_title(p, tester), p['campaign'] or 'no campaign', ': ' + '; '.join(parts) if parts else ''))
    return lines


class Stop(Exception):
    pass


def must(st, d, what):
    if st >= 300:
        raise Stop('stopped at "%s": HTTP %s %s' % (what, st, json.dumps(d)[:300]))
    return d


def current_layout(asset):
    cur = next((v for v in asset.get('versions') or [] if v.get('id') == asset.get('current')), None)
    return (cur or {}).get('layout') or {}


def laid_out(layout, block):
    """The house layout on a solid ground (no photograph to wait for); to block, the supporting line is moved onto the headline."""
    L = json.loads(json.dumps(layout))
    L['noImagery'] = True
    if block:
        layers = L.get('layers') or []
        h = next((l for l in layers if l.get('role') == 'headline'), None)
        sp = next((l for l in layers if l.get('role') == 'support'), None)
        if h and sp:
            sp['y'] = h.get('y', sp.get('y'))
            sp['x'] = h.get('x', sp.get('x'))
    return L


def seed_project(call, ns, p, tester):
    title = project_title(p, tester)
    d = must(*call('POST', '/studio/project', {'ns': ns, 'campaign': p['campaign'], 'title': title, 'brief': p['brief'], 'test': True,
                                              'idem': 'testkit:%s:%s' % (ns, title)}), 'project ' + title)
    proj = d.get('project') if isinstance(d.get('project'), dict) else d
    pid = proj.get('id') or d.get('id')
    if proj.get('test') is not True:
        raise Stop('project "%s" (%s) did not come back as a test project; nothing more was written to it. Check the worker build.' % (title, pid))
    if d.get('existing'):
        return pid, True
    if p.get('source'):
        must(*call('POST', '/studio/source', {'project': pid, 'kind': 'analyse:brief', 'name': 'Client note (synthetic)', 'text': p['source']}), 'source for ' + title)
    first = None
    for dd in p.get('directions', []):
        r = must(*call('POST', '/studio/direction', {'project': pid, 'data': dd, 'chosen': bool(p.get('choose') and first is None)}), 'direction ' + dd['title'])
        first = first or r.get('id')
    if p.get('reference'):
        img = base64.b64encode(png(240, 300, (11, 79, 108) if p['reference'] == 'harbour' else (19, 35, 47), ((247, 244, 238) if p['reference'] == 'harbour' else (242, 165, 65), 40))).decode()
        must(*call('POST', '/studio/reference', {'project': pid, 'name': 'Approved %s tile (synthetic)' % p['reference'], 'purpose': 'brand', 'imageB64': img, 'campaign': p['reference'], 'analyse': False,
                                                 'note': 'SYNTHETIC: a drawn stand-in for an approved tile of this campaign'}), 'reference for ' + title)
    for kind, (channel, fmt, copy) in p.get('assets', []):
        r = must(*call('POST', '/studio/asset', {'project': pid, 'channel': channel, 'format': fmt, 'family': 'Seeded set', 'mode': 'composition', 'copy': copy,
                                                 'title': '%s %s' % (channel.capitalize(), fmt), 'note': 'seeded by the test kit'}), 'piece for ' + title)
        a = r.get('asset') or {}
        if kind in ('pass', 'block'):
            must(*call('POST', '/studio/version', {'asset': a.get('id'), 'layout': laid_out(current_layout(a), kind == 'block'), 'revision': a.get('revision'),
                                                   'note': 'seeded: laid out on a solid ground' + (' with the supporting line over the headline (to block)' if kind == 'block' else '')}), 'layout for ' + title)
    return pid, False


def seed(o):
    call = lambda m, path, body=None: api(o.worker, o.key, m, path, body)
    st, status = call('GET', '/studio/status')
    must(st, status, 'reading /studio/status')
    build = status.get('build') or '?'
    names = [t.get('ns') for t in status.get('testNs') or []] if isinstance(status.get('testNs'), list) else None
    print('worker build %s' % build)
    if names is not None and o.ns not in names:
        raise Stop('%s is not a test namespace on this worker (it names %s). Add it to STUDIO_TEST_NS, or use synthdemo.' % (o.ns, ', '.join(names) or 'none'))
    for m, path, body, what in kit_steps(o.ns):
        must(*call(m, path, body), what)
        print('  ' + what)
    for p in PROJECTS:
        pid, existing = seed_project(call, o.ns, p, o.tester)
        print('  project %s  %s%s' % (pid, project_title(p, o.tester), ' (already there; left as it is)' if existing else ''))
    return build


def main(argv=None):
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('action', choices=['seed', 'reset'])
    a.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''), help='a full key (or set AXIOM_KEY)')
    a.add_argument('--worker', default=os.environ.get('AXIOM_WORKER', WORKER))
    a.add_argument('--ns', default='synthdemo', help='a test namespace (synthdemo, or one listed in the worker\'s STUDIO_TEST_NS)')
    a.add_argument('--apply', action='store_true', help='send it; without this nothing is written')
    a.add_argument('--tester', default='', help='a tester\'s name: their own set of projects (re-seeding without it leaves theirs alone)')
    o = a.parse_args(argv)
    if o.tester and not re.match(TESTER_RX, o.tester):
        sys.exit('--tester takes a plain name (letters, digits, spaces, dots, dashes; up to 31 characters).')
    if not o.key:
        sys.exit('A full key is needed: --key or AXIOM_KEY.')
    if o.ns in ('mca', 'aep', 'vicnats', 'pca', 'mba', 'pharm', 'guns', 'cmm'):
        sys.exit('%s is a live client. The test kit only writes to test namespaces (synthdemo, or one in STUDIO_TEST_NS).' % o.ns)
    if o.action == 'seed':
        for line in plan_seed(o.ns, o.tester):
            print(('send ' if o.apply else 'would send ') + line)
        if not o.apply:
            print('Nothing was sent. Add --apply to write it.')
            return 0
        try:
            seed(o)
        except Stop as e:
            sys.exit(str(e))
        print('Seeded %s. Testers pick "%s" under "Synthetic test clients" in the Studio. Nothing was approved.' % (o.ns, KIT['name']))
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
