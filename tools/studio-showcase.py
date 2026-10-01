#!/usr/bin/env python3
"""Show the Studio's finished creative work on the live worker, with the real models.

The sandbox that builds AXIOM cannot reach Anthropic or Google, so finished renders can only be made here, against the
deployed worker (Claude Opus 5.5 plans and inspects; Gemini 3 Pro Image draws). This runs the three demonstrations the
brief asked for and saves what came back, before and after, so the quality can be judged by looking:

  1. MCA: a cinematic myth opener and a coordinated fact-response slide (a two-frame carousel), campaign "national".
  2. HOOF: a myth / fact creative carrying the Hands Off Our Fuel wordmark (never the MCA logo), campaign "hoof".
  3. A fresh concept through "Create a new design", outside the preset compositions.

It needs the kit on the live worker (python3 tools/brand-logo.py ... for the MCA logo; --campaign hoof --wordmark for the
HOOF wordmark; python3 tools/studio-identity.py --ns mca --key ... shows what is on file) and spends model calls and
renders. Nothing paid runs until you approve a budget: without --approve-budget it prints the estimate and stops.
--approve-budget N caps the renders at N (Gemini images; each also gets one inspection call); a render that would
pass the cap is left queued and reported, never run.

The comparison is of complete composed tiles: after the imagery lands, tools/studio-compose.mjs draws each tile with the
app's own renderer (words, shapes and the exact logo or wordmark over the imagery) in headless Chromium, saves the PNG
here and on the worker as that version's export, and only then does the art director inspect - so the inspection judges
the composed tile, not the imagery alone. It needs Node and Playwright with Chromium on this machine
(npm i -D playwright && npx playwright install chromium); without them the run says so and shows imagery only.

  python3 tools/studio-showcase.py --key $AXIOM_KEY --out showcase/ \\
      --ref "path/to/cinematic-truck.png:inspiration:hierarchy, scale and atmosphere - a quality reference, not a brand specification" \\
      --ref "path/to/mca-carousel.png:approved:the MCA myth opener and fact-response carousel" \\
      --ref "path/to/hoof-myth-fact.png:approved:the HOOF MYTH/FACT identity: red and teal, symbols, the wordmark"

  --approve-budget N   --worker URL   --size 1K|2K|4K   --only mca|hoof|new   --no-inspect   --no-compose   --keep (do not archive the showcase projects)

Output: <out>/<case>/before.png (the house panel the Studio used to make), <out>/<case>/<asset>-v<n>.png per rendered
version (the imagery or the full artwork), <out>/<case>/export/*.png (the composed export, when the browser has saved one),
<out>/index.html with everything side by side and the inspections, and <out>/showcase.json with the facts: model and
resolution actually used, fallbacks, what is baked into a bitmap, the wording checks.
"""
import argparse, base64, html, json, mimetypes, os, shutil, subprocess, sys, time, urllib.request, urllib.error

DEFAULT_WORKER = 'https://newsaus.heshan-998.workers.dev'
UA = 'axiom-studio-showcase/1.0'
RELEASE = ("MEDIA RELEASE\n\nFuel tax credits keep regional Australia moving\n\nThe Minerals Council of Australia today released analysis showing that fuel tax credits are not a subsidy. "
           "Businesses do not pay a road fuel tax on fuel used off-road; the credit returns a tax that was never meant to apply.\n\n"
           "The credit is used by more than 150,000 businesses of all sizes, including farmers, fishers, builders, wineries, tourism operators and tradies.\n\nENDS")


def issue_text(ins):
    """An inspection's findings as one line: since P9 each carries a severity ({text, severity}); older events were plain strings."""
    out = []
    for i in ins.get('issues') or []:
        out.append('%s (%s)' % (i.get('text', ''), i.get('severity', 'material')) if isinstance(i, dict) else str(i))
    return '; '.join(out)


def assessed(ins):
    """The verdict with what stands beside it: a ship that names problems is inconsistent and is printed as such."""
    return ins.get('verdict', '') + (' (INCONSISTENT: ship with unresolved problems)' if ins.get('assessment') == 'inconsistent' else '') + ((', technical validation ' + ins['technical']) if ins.get('technical') else '')


def http(base, key, method, path, body=None, raw=False):
    req = urllib.request.Request(base + path, method=method, headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': UA},
                                 data=json.dumps(body).encode() if body is not None else None)
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
        raise SystemExit('%s %s -> HTTP %s %s' % (method, path, e.code, (d.get('error', '') + ' ' + d.get('detail', '')).strip() or rawb[:160]))


def step(base, key, job_id, label, tries=80):
    for _ in range(tries):
        j = http(base, key, 'POST', '/studio/job/step', {'id': job_id})['job']
        if j['state'] in ('done', 'failed', 'cancelled'):
            if j['state'] != 'done':
                print('  ! %s failed: %s' % (label, j.get('error', '')))
            return j
        time.sleep(3 if 'another runner' in (j.get('note') or '') else 1)
    print('  ! %s did not finish in time' % label)
    return None


BUDGET = {'renders': 0, 'cap': 0, 'held': []}


def pump(base, key, pid, label, stages=None):
    """Run the queued jobs on the project (only the stages named, when named) until none is left; a render past the approved cap is held, not run."""
    for _ in range(6):
        jobs = [j for j in http(base, key, 'GET', '/studio/jobs?project=' + pid)['jobs'] if j['state'] == 'queued' and (not stages or j['stage'] in stages) and j['id'] not in BUDGET['held']]
        if not jobs:
            return
        for j in sorted(jobs, key=lambda x: x['created']):
            if j['stage'] == 'render':
                if BUDGET['renders'] >= BUDGET['cap']:
                    print('  ! render %s held: the approved budget of %d renders is spent' % (j['id'], BUDGET['cap']))
                    BUDGET['held'].append(j['id']); continue
                BUDGET['renders'] += 1
            print('  running %s %s%s' % (j['stage'], j['id'], ' (' + (j.get('input') or {}).get('note', '')[:50] + ')' if (j.get('input') or {}).get('note') else ''))
            step(base, key, j['id'], label + ' ' + j['stage'])


def compose(base, key, args, pid, out):
    """Draw every current composition with the app's renderer and save it as the version's export (no model, no render)."""
    if args.no_compose:
        return {'ok': False, 'error': 'skipped (--no-compose)'}
    node = shutil.which('node')
    if not node:
        return {'ok': False, 'error': 'node is not installed: composed tiles cannot be drawn here; imagery only'}
    tool = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'studio-compose.mjs')
    r = subprocess.run([node, tool, '--key', key, '--project', pid, '--out', os.path.join(out, 'export'), '--save', '--worker', base], capture_output=True, text=True, timeout=600)
    try:
        d = json.loads((r.stdout or '').strip().splitlines()[-1])
    except Exception:
        d = {'ok': False, 'error': 'the compose tool failed: ' + ((r.stderr or r.stdout or '')[-300:])}
    if d.get('ok'):
        print('  composed %d tile%s with the app renderer' % (len(d['composed']), '' if len(d['composed']) == 1 else 's'))
    else:
        print('  ! composed tiles not drawn: %s %s' % (d.get('error', ''), d.get('detail', '')))
    return d


def save_png(base, key, url, path):
    data = http(base, key, 'GET', url, raw=True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(data)
    return path


def add_refs(base, key, pid, refs):
    ids = []
    for spec in refs:
        parts = spec.split(':', 2)
        path = parts[0]; purpose = parts[1] if len(parts) > 1 else 'inspiration'; note = parts[2] if len(parts) > 2 else ''
        if not os.path.isfile(path):
            print('  ! reference not found: ' + path); continue
        mime = mimetypes.guess_type(path)[0] or 'image/png'
        if mime not in ('image/png', 'image/jpeg', 'image/webp'):
            print('  ! reference must be PNG, JPEG or WebP: ' + path); continue
        b64 = base64.b64encode(open(path, 'rb').read()).decode()
        r = http(base, key, 'POST', '/studio/reference', {'project': pid, 'kind': 'image', 'name': os.path.basename(path), 'purpose': purpose, 'note': note, 'imageB64': b64, 'mime': mime})
        an = r.get('analysis') or {}
        print('  reference %s (%s): %s' % (os.path.basename(path), purpose, 'read - ' + an.get('summary', '')[:90] if an and not an.get('error') else 'not analysed: ' + str(an.get('error', 'no vision pass'))))
        ids.append(r['id'])
    return ids


def make_project(base, key, ns, campaign, title, channels, size='2K'):
    p = http(base, key, 'POST', '/studio/project', {'ns': ns, 'campaign': campaign, 'title': title, 'brief': {'objective': 'Answer the subsidy framing while the credit is in the news', 'audience': 'Members, MPs and the public on Instagram and Facebook', 'message': 'Fuel tax credits are not a subsidy; businesses of all sizes use them', 'channels': channels, 'deliverable': 'set'}, 'idem': 'showcase:%s:%s:%d' % (ns, campaign, int(time.time()))})
    s = http(base, key, 'POST', '/studio/source', {'project': p['id'], 'kind': 'release', 'name': 'Showcase release', 'text': RELEASE})
    j = http(base, key, 'POST', '/studio/job', {'project': p['id'], 'stage': 'extract', 'input': {'source': s['id']}, 'idem': 'showcase-extract:' + p['id']})['job']
    step(base, key, j['id'], 'extract')
    j = http(base, key, 'POST', '/studio/job', {'project': p['id'], 'stage': 'copy', 'input': {'channels': channels, 'deliverable': 'set', 'instruction': 'One tile per channel: the credit is not a subsidy; small businesses use it', 'render': True, 'size': size}, 'idem': 'showcase-copy:' + p['id']})['job']
    step(base, key, j['id'], 'copy')
    pump(base, key, p['id'], 'first production', stages=['render'])
    return p['id']


def snapshot(base, key, pid, out, tag):
    g = http(base, key, 'GET', '/studio/get?id=' + pid)
    saved = []
    for a in g['assets']:
        for i, v in enumerate(a['versions']):
            im = v.get('image') or {}
            if im.get('url'):
                path = os.path.join(out, '%s-v%d%s.png' % (a['title'].replace(' ', '_').replace('/', '-'), i + 1, '-artwork' if v.get('mode') == 'artwork' else ''))
                if not os.path.exists(path):
                    save_png(base, key, im['url'], path)
                saved.append({'asset': a['title'], 'version': v['id'], 'n': i + 1, 'file': os.path.relpath(path, os.path.dirname(out)), 'model': im.get('model'), 'requested': im.get('requested'), 'fallback': im.get('fallback'), 'size': im.get('size'), 'mode': v.get('mode'), 'baked': (v.get('layout') or {}).get('baked'), 'medium': (v.get('layout') or {}).get('mediumName'), 'note': v.get('note'), 'checks': [c['state'] + ' ' + c['text'] for c in (v.get('checks') or [])], 'references': (im.get('meta') or {}).get('references'), 'ms': (im.get('meta') or {}).get('ms'), 'asked': (v.get('context') or {}).get('size'), 'incomplete': [i.get('text') for i in ((v.get('layout') or {}).get('incomplete') or [])]})
    inspections = [e for e in g['thread'] if e.get('kind') == 'inspection']
    return {'tag': tag, 'project': pid, 'title': g['title'], 'campaign': g.get('campaign'), 'renders': saved, 'inspections': inspections, 'concepts': [e for e in g['thread'] if e.get('kind') == 'concepts']}


def run_case(base, key, args, case):
    out = os.path.join(args.out, case['tag']); os.makedirs(out, exist_ok=True)
    print('== %s' % case['title'])
    pid = make_project(base, key, 'mca', case['campaign'], case['title'], case['channels'], args.size)
    first = compose(base, key, args, pid, os.path.join(out, 'before'))
    g = http(base, key, 'GET', '/studio/get?id=' + pid)
    asset = next((a for a in g['assets'] if a['channel'] == case['channels'][0]), g['assets'][0])
    before = asset['versions'][-1]
    if (before.get('image') or {}).get('url'):
        save_png(base, key, before['image']['url'], os.path.join(out, 'before.png'))
        print('  before: the house panel over a %s render saved' % before['image'].get('model'))
    refs = add_refs(base, key, pid, args.ref)
    inp = {'asset': asset['id'], 'mode': case['mode'], 'feedback': case['instruction'], 'instruction': case['instruction']}
    if case['mode'] == 'new':
        inp['refs'] = refs; inp['keep'] = {'imagery': False, 'copy': True, 'composition': False}
    j = http(base, key, 'POST', '/studio/job', {'project': pid, 'asset': asset['id'], 'stage': 'concepts', 'input': inp, 'idem': 'showcase-concepts:' + pid})['job']
    done = step(base, key, j['id'], 'concepts')
    if not done or done['state'] != 'done':
        return snapshot(base, key, pid, out, case['tag'])
    ev = [e for e in http(base, key, 'GET', '/studio/get?id=' + pid)['thread'] if e.get('kind') == 'concepts'][-1]
    print('  critique: ' + ev.get('critique', '')[:160])
    for o in ev['options']:
        print('  %s) %s - %s%s' % ('ABC'[o['i']] if o['i'] < 3 else o['i'], o['name'], o.get('summary', ''), ' [looks like ' + o['similar'] + ']' if o.get('similar') else ''))
    pick = case['pick'](ev['options'])
    print('  generating "%s" (%s)' % (pick['name'], pick.get('cost')))
    r = http(base, key, 'POST', '/studio/concept/apply', {'project': pid, 'eid': ev['eid'], 'index': pick['i'], 'render': True, 'size': args.size})
    pump(base, key, pid, 'generate', stages=['render'])
    after = compose(base, key, args, pid, out)
    if args.no_inspect:
        for j in [j for j in http(base, key, 'GET', '/studio/jobs?project=' + pid)['jobs'] if j['state'] == 'queued' and j['stage'] == 'inspect']:
            http(base, key, 'POST', '/studio/job/cancel', {'id': j['id']})
    else:
        pump(base, key, pid, 'inspect', stages=['inspect'])
    if not args.no_inspect:
        for ins in [e for e in http(base, key, 'GET', '/studio/get?id=' + pid)['thread'] if e.get('kind') == 'inspection' and e.get('fix')][-2:]:
            print('  inspection: %s - %s; correction (%s): %s' % (assessed(ins), issue_text(ins), (ins.get('fix') or {}).get('kind', 'none'), (ins.get('fix') or {}).get('instruction', '')))
            if ins['verdict'] in ('fix', 'redo') and args.apply_fixes:
                http(base, key, 'POST', '/studio/inspection/apply', {'project': pid, 'eid': ins['eid']})
                pump(base, key, pid, 'correction', stages=['revise', 'render'])
                compose(base, key, args, pid, os.path.join(out, 'corrected'))
    snap = snapshot(base, key, pid, out, case['tag'])
    snap['before'] = os.path.relpath(os.path.join(out, 'before.png'), args.out) if os.path.exists(os.path.join(out, 'before.png')) else None
    snap['picked'] = pick['name']; snap['critique'] = ev.get('critique'); snap['refPack'] = ev.get('refPack'); snap['replanned'] = ev.get('replanned')
    snap['composedBefore'] = [dict(c, file=os.path.relpath(c['file'], args.out)) for c in (first.get('composed') or []) if c.get('file')]
    snap['composed'] = [dict(c, file=os.path.relpath(c['file'], args.out)) for c in (after.get('composed') or []) if c.get('file')]
    snap['composeError'] = None if after.get('ok') else (after.get('error') or '') + ' ' + (after.get('detail') or '')
    if not args.keep:
        http(base, key, 'POST', '/studio/project/archive', {'id': pid})
    return snap


def write_index(args, snaps):
    L = ['<!doctype html><meta charset="utf-8"><title>Studio showcase</title><style>body{font:14px/1.5 system-ui;background:#0f141a;color:#e6e9ee;margin:24px}h1,h2{font-weight:600}.row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}.card{background:#161d25;border:1px solid #27313c;border-radius:8px;padding:10px;max-width:360px}.card img{width:100%;border-radius:4px}.dim{color:#8a94a3;font-size:12px}.warn{color:#e8b04a}pre{white-space:pre-wrap;font-size:12px;color:#c5cbd3}</style>',
         '<h1>Creative Studio showcase</h1><p class="dim">Rendered on the live worker. The composed tiles are what would be exported: the app renderer drew the words, shapes and the exact mark over the generated imagery. Each imagery card names the model and resolution actually used against what was asked, whether a fallback happened, the reference images given to the image model, and whether the words are live layers or part of the bitmap. "before" is first production from the brief. An inspection verdict is the art director\'s opinion and approves nothing.</p>']
    for s in snaps:
        L.append('<h2>%s <span class="dim">(%s, campaign %s)</span></h2>' % (html.escape(s['title']), s['tag'], html.escape(str(s.get('campaign')))))
        if s.get('critique'):
            L.append('<p><b>Critique:</b> %s</p>' % html.escape(s['critique']))
        if s.get('composed') or s.get('composedBefore'):
            L.append('<h3>Composed tiles (the app renderer: imagery, words, shapes and the exact mark)</h3><div class="row">')
            for c in s.get('composedBefore') or []:
                L.append('<div class="card"><img src="%s"><div class="dim">before: first production, %s v%d</div></div>' % (html.escape(c['file']), html.escape(c['title']), c['n']))
            for c in s.get('composed') or []:
                L.append('<div class="card"><img src="%s"><div><b>%s</b> v%d, composed</div>%s</div>' % (html.escape(c['file']), html.escape(c['title']), c['n'], ('<div class="warn">incomplete: %s</div>' % html.escape('; '.join(c['incomplete']))) if c.get('incomplete') else ''))
            L.append('</div>')
        elif s.get('composeError'):
            L.append('<p class="warn">Composed tiles were not drawn on this machine (%s); the cards below are imagery only, and the inspections judged the imagery.</p>' % html.escape(s['composeError']))
        pk = s.get('refPack') or {}
        if pk:
            L.append('<p class="dim">Reference pack (%s): %d attached as images, %d read by analysis, %d excluded%s.%s</p>' % (html.escape(str(pk.get('mode'))), len(pk.get('attached') or []), len(pk.get('read') or []), len(pk.get('excluded') or []), (' (' + html.escape('; '.join(x['name'] + ': ' + x['why'] for x in pk.get('excluded') or [])) + ')') if pk.get('excluded') else '', (' Replanned %d look-alike concept(s) once.' % s['replanned']) if s.get('replanned') else ''))
        L.append('<h3>Imagery as generated</h3><div class="row">')
        if s.get('before'):
            L.append('<div class="card"><img src="%s"><div class="dim">before: the house panel (imagery only shown; words composed in the app)</div></div>' % html.escape(s['before']))
        for r in s['renders']:
            if s.get('before') and r['n'] == 1 and 'before' in r['file']:
                continue
            L.append('<div class="card"><img src="%s"><div><b>%s</b> v%d%s</div><div class="dim">%s at %s%s%s</div>%s%s</div>' % (html.escape(r['file']), html.escape(r['asset']), r['n'], ' - full artwork' if r['mode'] == 'artwork' else '', html.escape(str(r['model'])), html.escape(str(r['size'])), ' <span class="warn">fell back from %s</span>' % html.escape(str(r['requested'])) if r.get('fallback') else '', '; ' + html.escape(r['medium']) if r.get('medium') else '', '<div class="warn">words in the bitmap (not editable): %s</div>' % html.escape(', '.join(r['baked'])) if r.get('baked') else '<div class="dim">words and marks are live layers (composed in the app and the export)</div>', ('<div class="dim">checks: %s</div>' % html.escape('; '.join(r['checks'])) if r.get('checks') else '') + ('<div class="dim">asked %s; references given: %s%s</div>' % (html.escape(str(r.get('asked') or '-')), html.escape(', '.join(r.get('references') or []) or 'none'), (', %.1f s' % (r['ms'] / 1000.0)) if r.get('ms') else ''))))
        L.append('</div>')
        for ins in s.get('inspections') or []:
            sc = ins.get('scores') or {}
            L.append('<pre>inspection round %s (%s): %s - %s\n%s%s</pre>' % (ins.get('round'), 'the composed tile' if ins.get('composed') else 'imagery only', html.escape(assessed(ins)), ', '.join('%s %s' % (k, sc.get(k)) for k in ('fidelity', 'hierarchy', 'readability', 'relevance', 'identity')), html.escape(issue_text(ins)), ('\nwording not in the approved copy: ' + html.escape(', '.join(ins['words']['wrong']))) if (ins.get('words') or {}).get('wrong') else ''))
    open(os.path.join(args.out, 'index.html'), 'w').write('\n'.join(L))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--key', required=True); ap.add_argument('--worker', default=DEFAULT_WORKER); ap.add_argument('--out', default='showcase')
    ap.add_argument('--ref', action='append', default=[], help='path:purpose:note (repeatable)'); ap.add_argument('--size', default='2K', choices=['1K', '2K', '4K'])
    ap.add_argument('--only', choices=['mca', 'hoof', 'new']); ap.add_argument('--no-inspect', action='store_true'); ap.add_argument('--apply-fixes', action='store_true', help='apply the first correction each inspection offers'); ap.add_argument('--keep', action='store_true')
    ap.add_argument('--approve-budget', type=int, default=0, help='the most Gemini renders this run may spend; without it the estimate is printed and nothing runs'); ap.add_argument('--no-compose', action='store_true')
    args = ap.parse_args()
    base = args.worker.rstrip('/')
    kit = http(base, args.key, 'GET', '/brand/kit?ns=mca')
    camps = {c['id']: c for c in (kit.get('kit') or {}).get('campaigns') or []}
    print('MCA kit: logo %s; HOOF wordmark %s' % ('on file' if kit.get('hasLogo') else 'NOT on file (python3 tools/brand-logo.py <logo.png> --ns mca --key ...)', 'on file' if camps.get('hoof', {}).get('hasWordmark') else 'NOT on file (python3 tools/brand-logo.py <wordmark.png> --ns mca --campaign hoof --wordmark --key ...)'))
    budget = http(base, args.key, 'GET', '/studio/budget'); print('Studio model calls today %s of %s; creative %s' % (budget.get('used'), budget.get('cap'), (budget.get('models') or {}).get('creative')))
    os.makedirs(args.out, exist_ok=True)
    BUDGET['cap'] = args.approve_budget
    cases = [
        {'tag': 'mca', 'title': 'Showcase: MCA myth opener and fact response', 'campaign': 'national', 'channels': ['instagram'], 'mode': 'explore',
         'instruction': 'A cinematic myth opener and a coordinated fact-response slide, as a two-frame carousel: dramatic scale and atmosphere in the imagery, restrained graphic treatment, the MCA logo. The myth is "fuel tax credits are a subsidy for miners"; the fact answers it.',
         'pick': lambda opts: next((o for o in opts if o.get('frames')), opts[0])},
        {'tag': 'hoof', 'title': 'Showcase: HOOF myth / fact', 'campaign': 'hoof', 'channels': ['instagram'], 'mode': 'explore',
         'instruction': 'A Hands Off Our Fuel myth / fact creative in the HOOF identity: MYTH in red, FACT in teal, a relevant symbol, industry imagery, the HANDS OFF OUR FUEL wordmark and not the MCA logo.',
         'pick': lambda opts: next((o for o in opts if o.get('kind') == 'plan' and not o.get('similar')), opts[0])},
        {'tag': 'new', 'title': 'Showcase: a new design from the brief', 'campaign': 'national', 'channels': ['instagram'], 'mode': 'new',
         'instruction': 'Start again from the brief: a concept outside the panel-over-photograph pattern - typography-led, editorial or illustrated - that makes the 150,000 businesses figure the hero.',
         'pick': lambda opts: opts[0]},
    ]
    todo = [c for c in cases if not args.only or c['tag'] == args.only]
    # the estimate, before anything is spent: per case one extract and one production call, one or two concept calls,
    # one first-production render per channel, one to three renders for the chosen concept, one inspection per render
    est_renders = sum(len(c['channels']) + 3 for c in todo); est_calls = sum(2 + 2 + (len(c['channels']) + 3) for c in todo) + (0 if not args.apply_fixes else len(todo))
    print('Estimate for %d case(s) at %s: up to %d Gemini renders and about %d Claude calls (reference analyses and inspections included); the Studio daily cap counts the Claude calls.' % (len(todo), args.size, est_renders, est_calls))
    if args.approve_budget <= 0:
        print('Nothing was run. Approve a render budget to proceed, e.g. --approve-budget %d' % est_renders)
        return
    print('Approved: at most %d renders this run; a render past that is held and reported, not run.' % args.approve_budget)
    snaps = []
    for c in todo:
        snaps.append(run_case(base, args.key, args, c))
    print('renders spent: %d of %d approved%s' % (BUDGET['renders'], BUDGET['cap'], ('; held: ' + ', '.join(BUDGET['held'])) if BUDGET['held'] else ''))
    json.dump(snaps, open(os.path.join(args.out, 'showcase.json'), 'w'), indent=2)
    write_index(args, snaps)
    print('wrote %s/index.html with %d case(s); open it to compare before and after' % (args.out, len(snaps)))


if __name__ == '__main__':
    main()
