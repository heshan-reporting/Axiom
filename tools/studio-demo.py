#!/usr/bin/env python3
"""The Creative Studio demonstration, in six steps, on the live worker.

This is the walkthrough to show someone who has not used the Studio. It runs the agency's journey once per case and
writes one page of evidence (<out>/index.html, plus demo.json and the delivery bundles) that can be presented as it is:

  1. A brief with visible campaign knowledge and references: what the kit approves, what the Studio would assume, what
     is missing, and the reference pack, before anything is spent.
  2. Three genuinely different creative directions, with their medium and the measured diversity between them.
  3. The chosen direction produced, then refined as a new layout version on the same imagery: no new image call.
  4. A coordinated set: the master re-composed for the other channels' formats, the same argument in each.
  5. A client comment on a private review link, resolved in a new version that the comment is marked against.
  6. Approval of that exact version by the agency and then by the client, and a delivery bundle of only what both approved.

Cases:
  hoof   MCA, campaign Hands Off Our Fuel: carries the HOOF wordmark and never the MCA logo.
  mca    MCA, campaign national: carries the MCA logo.
  synth  A third client that is clearly labelled synthetic (namespace "synthdemo", "Harbourline Ferries - SYNTHETIC DEMO
         CLIENT"). Its kit, facts and logo are invented here and say so; it never touches a real client's kit. The
         kit is written only when the namespace has no kit yet or already holds this synthetic one.
After the cases, the separation check reads every composed asset's marks (HOOF carries only HOOF marks; MCA national only
the MCA logo; the synthetic client only its own) and the isolation audit of /studio/metrics for each namespace.

Spending. Nothing runs without approval: without --approve-calls the estimate is printed and the run stops. Model calls
are counted against --approve-calls; renders (Gemini images, each followed by one inspection call) against
--approve-renders, default 0. With no renders the demonstration picks typographic directions, which need no
photograph, so steps 3 to 6 complete with nothing generated as an image - and the page says so. A render past the cap is
held, never run.

Composition and measurement need Node and Playwright with Chromium on this machine (tools/studio-compose.mjs draws the
tiles with the app's renderer and files their validation); without them steps 5 and 6 cannot pass technical validation
and the page says why.

  python3 tools/studio-demo.py --key $AXIOM_KEY                                   # the estimate only
  python3 tools/studio-demo.py --key $AXIOM_KEY --approve-calls 40 --cases hoof,synth --out demo/
  python3 tools/studio-demo.py --key $AXIOM_KEY --approve-calls 60 --approve-renders 4 --size 2K \\
      --ref "refs/hoof-approved.png:approved:the HOOF myth/fact identity"

  --worker URL  --size 1K|2K|4K  --keep (do not archive the demo projects)  --no-compose
"""
import argparse, base64, html, json, mimetypes, os, shutil, struct, subprocess, sys, time, urllib.request, urllib.error, zlib

DEFAULT_WORKER = 'https://newsaus.heshan-998.workers.dev'
UA = 'axiom-studio-demo/1.0'
SYNTH_NS = 'synthdemo'
SYNTH_NAME = 'Harbourline Ferries - SYNTHETIC DEMO CLIENT'

RELEASE_MCA = ("MEDIA RELEASE\n\nFuel tax credits keep regional Australia moving\n\nThe Minerals Council of Australia today released analysis showing that "
               "fuel tax credits are not a subsidy. Businesses do not pay a road fuel tax on fuel used off-road; the credit returns a tax that was never meant to apply.\n\n"
               "The credit is used by more than 150,000 businesses of all sizes, including farmers, fishers, builders, wineries, tourism operators and tradies.\n\nENDS")
RELEASE_SYNTH = ("MEDIA RELEASE (SYNTHETIC - invented for a demonstration; not a real organisation)\n\nHarbourline adds a late ferry for shift workers\n\n"
                 "Harbourline Ferries will run a 11.40pm service from Monday, after 2,300 commuters asked for a later sailing.\n\n"
                 "\"Hospital and hospitality staff finish late. The last boat should not leave before they do,\" said the general manager, Alex Rivera.\n\nENDS")

CASES = {
    'hoof': {'ns': 'mca', 'campaign': 'hoof', 'title': 'Demo - HOOF: the credit is not a subsidy', 'release': RELEASE_MCA,
             'brief': {'objective': 'Answer the subsidy framing while fuel tax credits are in the news', 'audience': 'Regional voters and small business owners on Instagram and Facebook',
                       'message': 'Fuel tax credits are not a subsidy; businesses of all sizes use them', 'action': 'handsoffourfuel.com.au'},
             'channels': ['instagram'], 'adapt': ['facebook', 'linkedin'], 'comment': 'Could the call to action say "Read the facts" instead?', 'answer': {'cta': 'Read the facts'}},
    'mca': {'ns': 'mca', 'campaign': 'national', 'title': 'Demo - MCA national: who uses the credit', 'release': RELEASE_MCA,
            'brief': {'objective': 'Show who uses fuel tax credits', 'audience': 'Members, MPs and the public on LinkedIn and Facebook', 'message': 'Farmers, fishers, builders and tradies use the credit'},
            'channels': ['linkedin'], 'adapt': ['facebook'], 'comment': 'Please end on "Australian mining" rather than the generic line.', 'answer': {'cta': 'Australian mining'}},
    'synth': {'ns': SYNTH_NS, 'campaign': 'latesail', 'title': 'Demo - SYNTHETIC client: the late ferry', 'release': RELEASE_SYNTH,
              'brief': {'objective': 'Announce the new late sailing (synthetic demonstration)', 'audience': 'Shift workers who commute by ferry', 'message': 'A later last boat, because shifts end late'},
              'channels': ['instagram'], 'adapt': ['facebook'], 'comment': 'Say the time in the headline, please.', 'answer': {'headline': 'The last boat now leaves at 11.40pm'}},
}


class Stop(Exception):
    pass


def http(base, key, method, path, body=None, raw=False, headers=None, ok_codes=()):
    h = {'Content-Type': 'application/json', 'User-Agent': UA}
    if key:
        h['X-Axiom-Key'] = key
    h.update(headers or {})
    req = urllib.request.Request(base + path, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=240) as r:
            data = r.read()
            return data if raw else json.loads(data.decode() or '{}')
    except urllib.error.HTTPError as e:
        rawb = e.read().decode(errors='replace')
        try:
            d = json.loads(rawb or '{}')
        except Exception:
            d = {}
        if e.code in ok_codes:
            return dict(d, _status=e.code)
        raise Stop('%s %s -> HTTP %s %s' % (method, path, e.code, (d.get('error', '') + ' ' + d.get('detail', '')).strip() or rawb[:160]))


SPEND = {'calls': 0, 'renders': 0, 'cap_calls': 0, 'cap_renders': 0, 'held': []}


def charge(stage):
    """Count one job against the approved caps before it runs; a job that would pass a cap is refused."""
    if stage == 'render':
        if SPEND['renders'] >= SPEND['cap_renders']:
            return False
        SPEND['renders'] += 1
        return True
    if stage == 'export':
        return True
    if SPEND['calls'] >= SPEND['cap_calls']:
        raise Stop('the approved budget of %d model calls is spent; nothing further was run' % SPEND['cap_calls'])
    SPEND['calls'] += 1
    return True


def step(base, key, job_id, label, tries=80):
    for _ in range(tries):
        j = http(base, key, 'POST', '/studio/job/step', {'id': job_id})['job']
        if j['state'] in ('done', 'failed', 'cancelled'):
            if j['state'] != 'done':
                print('  ! %s failed: %s' % (label, j.get('error', '')))
            return j
        time.sleep(3 if 'another runner' in (j.get('note') or '') else 0.5)
    print('  ! %s did not finish in time' % label)
    return None


def job(base, key, pid, stage, inp, label, asset=None):
    charge(stage)
    j = http(base, key, 'POST', '/studio/job', {'project': pid, 'stage': stage, 'input': inp, 'asset': asset, 'idem': 'demo:%s:%s:%d' % (pid, stage, int(time.time() * 1000))})['job']
    print('  running %s (%s)' % (stage, label))
    return step(base, key, j['id'], label)


def pump(base, key, pid):
    """Run what production queued: renders within the cap (each then queues one inspection call), the rest held."""
    for _ in range(6):
        jobs = [j for j in http(base, key, 'GET', '/studio/jobs?project=' + pid)['jobs'] if j['state'] == 'queued' and j['id'] not in SPEND['held']]
        if not jobs:
            return
        for j in sorted(jobs, key=lambda x: x['created']):
            if j['stage'] == 'render' and not charge('render'):
                print('  ! render %s held: the approved budget of %d renders is spent' % (j['id'], SPEND['cap_renders']))
                SPEND['held'].append(j['id']); http(base, key, 'POST', '/studio/job/cancel', {'id': j['id']}); continue
            if j['stage'] != 'render':
                charge(j['stage'])
            step(base, key, j['id'], j['stage'])


def compose(base, key, args, pid, out):
    """Draw every current composition with the app's renderer, file its validation and save it as the export."""
    if args.no_compose:
        return {'ok': False, 'error': 'skipped (--no-compose)'}
    node = shutil.which('node')
    if not node:
        return {'ok': False, 'error': 'node is not installed here'}
    tool = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'studio-compose.mjs')
    r = subprocess.run([node, tool, '--key', key, '--project', pid, '--out', out, '--save', '--worker', base], capture_output=True, text=True, timeout=600)
    try:
        return json.loads((r.stdout or '').strip().splitlines()[-1])
    except Exception:
        return {'ok': False, 'error': 'the compose tool failed: ' + ((r.stderr or r.stdout or '')[-300:])}


def get(base, key, pid):
    return http(base, key, 'GET', '/studio/get?id=' + pid)


def current(a):
    return next((v for v in a['versions'] if v['id'] == a['current']), a['versions'][-1])


def png(w, h, rgb):
    """A flat PNG, written by hand so the tool needs no imaging library: the synthetic client's placeholder logo."""
    row = b'\x00' + bytes(rgb) * w
    raw = zlib.compress(row * h)
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', raw) + chunk(b'IEND', b'')


def ensure_synth(base, key):
    """The synthetic client's kit: written only into an empty namespace or over this same synthetic kit, never a real one."""
    k = http(base, key, 'GET', '/brand/kit?ns=' + SYNTH_NS)
    kit = k.get('kit') or k
    if kit and kit.get('name') and 'SYNTHETIC' not in str(kit.get('name')):
        raise Stop('namespace %s holds a kit named "%s", which is not the synthetic demo kit; nothing was written' % (SYNTH_NS, kit.get('name')))
    http(base, key, 'POST', '/brand/kit', {'ns': SYNTH_NS, 'name': SYNTH_NAME, 'voice': 'Plain, warm and local. Invented for a demonstration.',
                                           'palette': {'primary': '#1D4E89', 'secondary': '#F2B134', 'bg': '#F7F7F2', 'text': '#10161F'},
                                           'campaigns': [{'id': 'latesail', 'name': 'Late sailing (synthetic)', 'logoPolicy': 'logo', 'identity': 'Navy ground, amber accent. Synthetic.'}],
                                           'facts': [{'text': 'The new sailing leaves at 11.40pm', 'source': 'synthetic release', 'status': 'approved', 'campaign': 'latesail'},
                                                     {'text': '2,300 commuters asked for a later sailing', 'source': 'synthetic release', 'status': 'approved', 'campaign': 'latesail'}],
                                           'banned': [{'term': 'cheap', 'use': 'affordable', 'why': 'synthetic house style'}],
                                           'logoB64': base64.b64encode(png(240, 80, (242, 177, 52))).decode(), 'logoMime': 'image/png'})


def add_refs(base, key, pid, refs, case_id):
    out = []
    for spec in refs:
        parts = spec.split(':', 2); path = parts[0]
        if not os.path.isfile(path):
            print('  ! reference not found: ' + path); continue
        mime = mimetypes.guess_type(path)[0] or 'image/png'
        r = http(base, key, 'POST', '/studio/reference', {'project': pid, 'kind': 'image', 'name': os.path.basename(path), 'purpose': parts[1] if len(parts) > 1 else 'inspiration', 'note': parts[2] if len(parts) > 2 else '', 'imageB64': base64.b64encode(open(path, 'rb').read()).decode(), 'mime': mime})
        out.append({'name': os.path.basename(path), 'purpose': parts[1] if len(parts) > 1 else 'inspiration', 'read': not (r.get('analysis') or {}).get('error')})
    if case_id == 'synth' and not out:
        r = http(base, key, 'POST', '/studio/reference', {'project': pid, 'kind': 'image', 'name': 'synthetic-brand-swatch.png', 'purpose': 'brand', 'note': 'SYNTHETIC: a flat swatch of the invented palette', 'imageB64': base64.b64encode(png(320, 200, (29, 78, 137))).decode(), 'mime': 'image/png'})
        out.append({'name': 'synthetic-brand-swatch.png', 'purpose': 'brand', 'read': not (r.get('analysis') or {}).get('error'), 'synthetic': True})
    return out


def marks_of(v):
    return [l.get('src') for l in ((v.get('layout') or {}).get('layers') or []) if l.get('type') == 'img' and l.get('role') in ('logo', 'wordmark') and not l.get('hidden')]


def run_case(base, key, args, cid, rec):
    c = CASES[cid]; out = os.path.join(args.out, cid); os.makedirs(out, exist_ok=True)
    rec.update({'case': cid, 'ns': c['ns'], 'campaign': c['campaign'], 'title': c['title'], 'synthetic': cid == 'synth', 'steps': []})
    say = lambda n, text, **kw: (rec['steps'].append(dict({'n': n, 'text': text}, **kw)), print('  [%d] %s' % (n, text)))
    print('== ' + c['title'])
    if cid == 'synth':
        ensure_synth(base, key)
    # 1. the brief, the knowledge and the references, before anything is spent
    brief = dict(c['brief'], channels=c['channels'], deliverable='set', campaignConfirmed=True, size=args.size)
    p = http(base, key, 'POST', '/studio/project', {'ns': c['ns'], 'campaign': c['campaign'], 'title': c['title'], 'brief': brief, 'idem': 'demo:%s:%d' % (cid, int(time.time()))})
    pid = rec['project'] = p['id']
    src = http(base, key, 'POST', '/studio/source', {'project': pid, 'kind': 'release', 'name': 'Demo release', 'text': c['release']})
    job(base, key, pid, 'extract', {'source': src['id']}, 'reading the release into a claim ledger')
    refs = add_refs(base, key, pid, args.ref if cid != 'synth' else [], cid)
    chk = http(base, key, 'GET', '/studio/brief/check?project=' + pid)
    ws = http(base, key, 'GET', '/brand/workspace?ns=%s&campaign=%s' % (c['ns'], c['campaign']))
    by_auth = ws.get('counts') or {}
    items = [None] * sum(by_auth.values())
    policy = ((ws.get('campaign') or {}).get('policy')) or 'not set'
    gaps = [str(g.get('text') or g.get('code')).rstrip('.') for g in (chk.get('gaps') or [])]
    blocking = [g for g in (chk.get('gaps') or []) if g.get('level') == 'blocking' or g.get('mandatory')]
    say(1, 'Brief with campaign knowledge: %d items on file for %s/%s (%s), mark policy %s; %d reference%s (%s); %d gap%s before spending%s.' % (
        len(items), c['ns'], c['campaign'], ', '.join('%d %s' % (v, k) for k, v in sorted(by_auth.items())) or 'none', policy, len(refs), '' if len(refs) == 1 else 's',
        ', '.join(r['name'] + ' as ' + r['purpose'] + (' (synthetic)' if r.get('synthetic') else '') for r in refs) or 'none attached',
        len(gaps), '' if len(gaps) == 1 else 's', (': ' + '; '.join(gaps)) if gaps else ''), knowledge=by_auth, gaps=gaps, refs=refs, marks=chk.get('marks'))
    if blocking:
        raise Stop('the brief has a mandatory gap the team must close first: ' + '; '.join(g.get('text') or g.get('code') for g in blocking))
    # 2. three directions
    job(base, key, pid, 'direct', {'n': 3, 'channels': c['channels']}, 'proposing three directions')
    g = get(base, key, pid); dirs = g['directions']
    ev = [e for e in g['thread'] if e.get('kind') in ('directions', 'direct')]
    div = ev[-1].get('diversity') if ev else None
    say(2, '%d directions: %s. Diversity: %s.' % (len(dirs), '; '.join('"%s" (%s)' % (d['title'], (d.get('medium') or d.get('plan', {}).get('medium') or 'medium not stated')) for d in dirs),
        ('%s (1 = nothing in common)' % div) if div is not None else 'not measured'), directions=[{'title': d['title'], 'medium': d.get('medium'), 'similar': d.get('similar')} for d in dirs], diversity=div)
    if not dirs:
        raise Stop('no direction came back')
    want_type = SPEND['cap_renders'] == 0
    pick = next((d for d in dirs if want_type and str(d.get('medium') or '').startswith('typographic')), dirs[0])
    http(base, key, 'POST', '/studio/direction/choose', {'id': pick['id']})
    # 3. production, then a refinement that keeps the imagery
    j = job(base, key, pid, 'copy', {'channels': c['channels'], 'deliverable': 'set', 'direction': pick['id'], 'size': args.size, 'render': SPEND['cap_renders'] > 0,
                                     'instruction': 'Typographic: no photograph; the words and the mark carry it.' if want_type else ''}, 'writing and laying out the master')
    if not j or j['state'] != 'done':
        raise Stop('production failed: ' + ((j or {}).get('error') or 'no answer'))
    r0 = SPEND['renders']; pump(base, key, pid)
    g = get(base, key, pid); master = g['assets'][0]; v0 = current(master)
    cj = job(base, key, pid, 'concepts', {'asset': master['id'], 'mode': 'refine', 'feedback': 'Refine this: sharper hierarchy, same message, keep what works.', 'keep': {'imagery': True, 'copy': True, 'composition': False}}, 'refining the chosen design', asset=master['id'])
    renders_before = SPEND['renders']
    applied = None
    if cj and cj['state'] == 'done':
        cev = [e for e in get(base, key, pid)['thread'] if e.get('kind') == 'concepts'][-1]
        opt = next((o for o in cev['options'] if not o.get('needsImage')), cev['options'][0])
        applied = http(base, key, 'POST', '/studio/concept/apply', {'project': pid, 'eid': cev['eid'], 'index': opt['i'], 'render': False})
    g = get(base, key, pid); master = next(a for a in g['assets'] if a['id'] == master['id']); v1 = current(master)
    say(3, 'Produced "%s" (%s, %s) from "%s"%s; refined to v%d "%s" as a layout version on the same imagery: %d new image call%s for the refinement.' % (
        master['title'], master['format'], (v0.get('layout') or {}).get('mediumName') or v0.get('mode'), pick['title'],
        (' with %d render%s' % (SPEND['renders'] - r0, '' if SPEND['renders'] - r0 == 1 else 's')) if SPEND['renders'] - r0 else ' with no render',
        len(master['versions']), (opt['name'] if applied else 'not applied'), SPEND['renders'] - renders_before, '' if SPEND['renders'] - renders_before == 1 else 's'),
        imageSame=(v0.get('image') or {}).get('key') == (v1.get('image') or {}).get('key'), version=v1['id'])
    # 4. the coordinated set
    aj = job(base, key, pid, 'revise', {'target': 'asset', 'asset': master['id'], 'instruction': 'Adapt this for %s: the same argument, re-composed for each format, nothing re-rendered.' % ' and '.join(c['adapt'])}, 'adapting the master for ' + ', '.join(c['adapt']))
    pump(base, key, pid)
    g = get(base, key, pid)
    say(4, 'Coordinated set: %s - %d asset%s in the family, each re-composed for its own format from the master\'s plan.' % (
        ', '.join('%s %s' % (a['title'], a['format']) for a in g['assets']), len(g['assets']), '' if len(g['assets']) == 1 else 's'), assets=[{'title': a['title'], 'format': a['format'], 'marks': marks_of(current(a))} for a in g['assets']])
    comp = compose(base, key, args, pid, os.path.join(out, 'tiles'))
    rec['composed'] = [dict(x, file=os.path.relpath(x['file'], args.out)) for x in (comp.get('composed') or []) if x.get('file')]
    failing = [(x.get('title'), list((x.get('validation') or {}).get('blocking') or [])) for x in comp.get('composed') or [] if (x.get('validation') or {}).get('ok') is False]
    if failing:
        rec['validationFailing'] = failing
        print('  ! technical validation failing: ' + '; '.join('%s: %s' % (t, ', '.join(i)) for t, i in failing))
    if not comp.get('ok'):
        rec['composeError'] = (comp.get('error') or '') + ' ' + (comp.get('detail') or '')
        raise Stop('the tiles could not be composed and measured here (%s); steps 5 and 6 need a passing technical validation' % rec['composeError'].strip())
    # 5. a client comment, resolved in a new version
    share = http(base, key, 'POST', '/studio/share', {'project': pid, 'assets': [master['id']], 'label': 'Demo review', 'expiresDays': 7, 'allowApprove': True})
    tok = {'X-Review-Token': share['token']}
    rv = http(base, None, 'GET', '/review/get', headers=tok)
    seen = next(x for x in rv['assets'] if x['id'] == master['id'])
    cm = http(base, None, 'POST', '/review/comment', {'asset': master['id'], 'version': seen['version']['id'], 'text': c['comment'], 'author': 'Client reviewer (demo)', 'x': 50, 'y': 80}, headers=tok)
    g = get(base, key, pid); master = next(a for a in g['assets'] if a['id'] == master['id'])
    http(base, key, 'POST', '/studio/version', {'asset': master['id'], 'revision': master['revision'], 'copy': c['answer'], 'note': 'client comment: ' + c['comment'][:80]})
    comp2 = compose(base, key, args, pid, os.path.join(out, 'tiles-v2'))
    rec['composed2'] = [dict(x, file=os.path.relpath(x['file'], args.out)) for x in (comp2.get('composed') or []) if x.get('file')]
    g = get(base, key, pid); master = next(a for a in g['assets'] if a['id'] == master['id']); v2 = current(master)
    http(base, key, 'POST', '/studio/review/resolve', {'project': pid, 'id': cm['id'], 'version': v2['id'], 'note': 'Changed as asked.'})
    say(5, 'Client comment "%s" pinned on v%d; answered by a text edit (no model call), v%d, which the comment is marked as addressed in.' % (c['comment'], seen['version']['n'], len(master['versions'])), comment=c['comment'], answeredIn=v2['id'])
    # 6. exact-version approval, agency then client, and the delivery bundle
    for part in ('copy', 'design'):
        a = http(base, key, 'POST', '/studio/approve', {'asset': master['id'], 'part': part, 'decision': 'approve', 'reason': 'Demo: %s checked against the brief and the kit' % part}, ok_codes=(409,))
        if a.get('_status') == 409:
            raise Stop('the agency could not approve the %s: %s %s' % (part, a.get('error', ''), a.get('detail', '')))
    rv = http(base, None, 'GET', '/review/get', headers=tok); seen = next(x for x in rv['assets'] if x['id'] == master['id'])
    http(base, None, 'POST', '/review/decision', {'asset': master['id'], 'version': seen['version']['id'], 'decision': 'approve', 'author': 'Client reviewer (demo)', 'text': 'Approved.'}, headers=tok)
    ej = job(base, key, pid, 'export', {'assets': [master['id']], 'requireClient': True}, 'packaging what the client approved')
    res = (ej or {}).get('result') or {}
    bundle = os.path.join(out, 'bundle'); os.makedirs(bundle, exist_ok=True); files = []
    keys = list((res.get('files') or {}).values()) + [x['exportKey'] for x in res.get('included') or [] if x.get('exportKey')]
    for k in keys:
        path = os.path.join(bundle, os.path.basename(k))
        open(path, 'wb').write(http(base, key, 'GET', '/studio/file?key=' + urllib.request.quote(k, safe=''), raw=True)); files.append(os.path.relpath(path, args.out))
    say(6, 'Approved by the agency (copy and design) and by the client, both on v%d exactly; the bundle holds %d file%s%s.' % (
        len(master['versions']), len(files), '' if len(files) == 1 else 's', ('; left out: ' + '; '.join(str(x.get('title') or x.get('asset')) + ' (' + str(x.get('why') or x.get('reason') or '') + ')' for x in res.get('excluded') or [])) if res.get('excluded') else ''), bundle=files, export=res.get('export'))
    g = get(base, key, pid)
    rec['marks'] = {a['title']: marks_of(current(a)) for a in g['assets']}
    if not args.keep:
        http(base, key, 'POST', '/studio/project/archive', {'id': pid})
    return rec


def separation(base, key, recs):
    """Each case's marks must be its own: HOOF only HOOF marks, MCA national only the MCA logo, the synthetic client only its own."""
    out = []
    for r in recs:
        for title, ms in (r.get('marks') or {}).items():
            for m in ms:
                bad = ('ns=' + r['ns']) not in m or (r['campaign'] == 'hoof' and '/brand/logo' in m) or ('/brand/wordmark' in m and ('campaign=' + r['campaign']) not in m)
                out.append({'case': r['case'], 'asset': title, 'mark': m, 'ok': not bad})
            if not ms:
                out.append({'case': r['case'], 'asset': title, 'mark': '(no mark layer)', 'ok': True})
    iso = {}
    for ns in sorted(set(r['ns'] for r in recs)):
        m = http(base, key, 'GET', '/studio/metrics?ns=%s&days=1' % ns)
        iso[ns] = m.get('isolation') or {}
    return out, iso


def estimate(cases, renders):
    calls = 5 * len(cases)  # extract, direct, copy, concepts (refine), revise (adapt); export is not a model call
    return {'cases': cases, 'calls': calls + renders, 'renders': renders, 'note': 'about 5 model calls per case, plus one inspection per image; renders only up to --approve-renders'}


def write_index(args, recs, sep, iso, meta):
    e = html.escape
    L = ['<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio demonstration</title>',
         '<style>body{font:14px/1.55 system-ui;background:#0f141a;color:#e6e9ee;margin:24px;max-width:1100px}h1,h2{font-weight:600}h2{margin-top:32px}ol{padding-left:20px}li{margin:6px 0}.dim{color:#8a94a3;font-size:12.5px}.ok{color:#5ec27a}.bad{color:#e76f6f}.warn{color:#e8b04a}.row{display:flex;gap:12px;flex-wrap:wrap}.card{background:#161d25;border:1px solid #27313c;border-radius:8px;padding:8px;width:240px}.card img{width:100%;border-radius:4px}table{border-collapse:collapse;font-size:13px}a{color:#8cc4ff}td,th{border-bottom:1px solid #27313c;padding:4px 8px;text-align:left}</style>',
         '<h1>Creative Studio: the journey in six steps</h1>',
         '<p class="dim">Run %s on %s. Model calls used: %d of %d approved; images: %d of %d approved%s. Each step below is what the worker recorded, not a description of what it would do. "Synthetic" marks invented material.</p>' % (
             e(meta['at']), e(meta['worker']), SPEND['calls'], SPEND['cap_calls'], SPEND['renders'], SPEND['cap_renders'], (' (%d held)' % len(SPEND['held'])) if SPEND['held'] else '')]
    for r in recs:
        L.append('<h2>%s%s <span class="dim">%s / %s, project %s</span></h2>' % (e(r['title']), ' <span class="warn">(SYNTHETIC CLIENT)</span>' if r.get('synthetic') else '', e(r['ns']), e(r['campaign']), e(r.get('project', '-'))))
        L.append('<ol>' + ''.join('<li>%s</li>' % e(s['text']) for s in r['steps']) + '</ol>')
        if r.get('stopped'):
            L.append('<p class="bad">Stopped: %s</p>' % e(r['stopped']))
        for label, key in (('After step 4: the set as composed by the app renderer', 'composed'), ('After step 5: the version the client approved', 'composed2')):
            if r.get(key):
                L.append('<p class="dim">%s</p><div class="row">%s</div>' % (label, ''.join('<div class="card"><img src="%s" alt=""><div class="dim">%s v%s%s</div></div>' % (e(x['file']), e(x.get('title', '')), e(str(x.get('n', ''))), (' - validation ' + ('passed' if (x.get('validation') or {}).get('ok') else 'failing')) if x.get('validation') is not None else '') for x in r[key])))
        b = next((s for s in r['steps'] if s['n'] == 6), None)
        if b and b.get('bundle'):
            L.append('<p class="dim">Delivery bundle: %s</p>' % ', '.join('<a href="%s">%s</a>' % (e(f), e(os.path.basename(f))) for f in b['bundle']))
    L.append('<h2>Separation</h2><table><tr><th>Case</th><th>Asset</th><th>Mark</th><th></th></tr>' + ''.join('<tr><td>%s</td><td>%s</td><td>%s</td><td class="%s">%s</td></tr>' % (e(x['case']), e(x['asset']), e(x['mark']), 'ok' if x['ok'] else 'bad', 'own' if x['ok'] else 'NOT ITS OWN') for x in sep) + '</table>')
    L.append('<p>Isolation audit: ' + '; '.join('%s %s (%s versions; %s rules, %s references, %s marks read)' % (e(ns), '<span class="ok">clean</span>' if v.get('clean') else '<span class="bad">%d item(s) belonging elsewhere</span>' % len(v.get('violations') or []), v.get('versions'), (v.get('checked') or {}).get('rules'), (v.get('checked') or {}).get('references'), (v.get('checked') or {}).get('marks')) for ns, v in iso.items()) + '</p>')
    L.append('<p class="dim">What this does not show: whether the work is good. That is for the people looking at it. The inspections, when images were approved, are the art director model\'s opinion and approve nothing.</p>')
    open(os.path.join(args.out, 'index.html'), 'w').write('\n'.join(L))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--key', required=True); ap.add_argument('--worker', default=DEFAULT_WORKER); ap.add_argument('--out', default='demo')
    ap.add_argument('--cases', default='hoof,mca,synth', help='comma-separated: hoof, mca, synth')
    ap.add_argument('--approve-calls', type=int, default=0, help='the most model calls this run may spend; without it the estimate is printed and nothing runs')
    ap.add_argument('--approve-renders', type=int, default=0, help='the most Gemini images (default 0: typographic directions, no image)')
    ap.add_argument('--size', default='2K', choices=['1K', '2K', '4K']); ap.add_argument('--ref', action='append', default=[], help='path:purpose:note for the MCA cases (repeatable)')
    ap.add_argument('--keep', action='store_true'); ap.add_argument('--no-compose', action='store_true')
    args = ap.parse_args(); base = args.worker.rstrip('/')
    cases = [c.strip() for c in args.cases.split(',') if c.strip()]
    bad = [c for c in cases if c not in CASES]
    if bad:
        raise SystemExit('unknown case: ' + ', '.join(bad))
    est = estimate(cases, args.approve_renders)
    print('Estimate for %d case%s (%s): about %d model calls and %d image%s. %s.' % (len(cases), '' if len(cases) == 1 else 's', ', '.join(cases), est['calls'], est['renders'], '' if est['renders'] == 1 else 's', est['note']))
    if args.approve_calls <= 0:
        print('Nothing was run. Approve a budget with --approve-calls N (and --approve-renders N for images).')
        return
    SPEND['cap_calls'] = args.approve_calls; SPEND['cap_renders'] = args.approve_renders
    print('Approved: at most %d model calls and %d renders.' % (SPEND['cap_calls'], SPEND['cap_renders']))
    st = http(base, args.key, 'GET', '/studio/status')
    meta = {'at': time.strftime('%Y-%m-%d %H:%M'), 'worker': base, 'build': st.get('build')}
    os.makedirs(args.out, exist_ok=True); recs = []
    for cid in cases:
        rec = {'case': cid, 'ns': CASES[cid]['ns'], 'campaign': CASES[cid]['campaign'], 'title': CASES[cid]['title'], 'synthetic': cid == 'synth', 'steps': []}
        try:
            run_case(base, args.key, args, cid, rec)
        except Stop as ex:
            print('  ! stopped: %s' % ex)
            rec['stopped'] = str(ex)
        recs.append(rec)
    sep, iso = separation(base, args.key, recs)
    for x in sep:
        print('  separation %s: %s %s - %s' % (x['case'], x['asset'], x['mark'], 'own' if x['ok'] else 'NOT ITS OWN'))
    for ns, v in iso.items():
        print('  isolation %s: %s' % (ns, 'clean' if v.get('clean') else '%d item(s) belonging elsewhere' % len(v.get('violations') or [])))
    write_index(args, recs, sep, iso, meta)
    json.dump({'meta': meta, 'spend': SPEND, 'cases': recs, 'separation': sep, 'isolation': iso}, open(os.path.join(args.out, 'demo.json'), 'w'), indent=2)
    done = sum(1 for r in recs if not r.get('stopped') and len(r['steps']) == 6)
    print('Done: %d of %d case%s completed all six steps; %d model calls, %d renders. Open %s' % (done, len(recs), '' if len(recs) == 1 else 's', SPEND['calls'], SPEND['renders'], os.path.join(args.out, 'index.html')))
    if done < len(recs):
        sys.exit(1)


if __name__ == '__main__':
    main()
