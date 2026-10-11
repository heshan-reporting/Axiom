#!/usr/bin/env python3
"""The Creative Studio smoke test, owner-run, on the live worker, with a hard spending cap.

It builds on tools/studio-demo.py (the same HTTP helpers, cases and compose tool) and proves, with real models and the deployed
worker, what the harnesses can only prove with mocked providers:

  for each case (HOOF - Hands Off Our Fuel, MCA national, and the labelled synthetic client):
    Editable path   a release read into a claim ledger; the copy stage writes and lays out the master; the master is re-laid,
                    free of charge, for other formats (story 9:16, LinkedIn 1.91:1, square 1:1); every tile is drawn with the
                    app's renderer, repaired if it can be (no render), measured and filed; the tiles that pass are approved and
                    exported, and the export is checked to hold exactly those.
    Full AI path    (only with renders approved) the copy stage in finished mode; one painting per piece with the campaign's
                    mark file attached; the inspection reads the words and the mark back from that exact image; the piece is
                    approved and exported only if the reading verified it, and a mark not shown to match is reported as such.
  then: each case's marks are its own (HOOF never carries the MCA logo), and the isolation audit is clean.

Spending. Nothing runs without --approve-calls. The worker publishes its attempt policy in /studio/budget (S24): the most
requests one job can send, every retry, fallback model and job attempt included - a stage's logical calls times the attempts per
call, and for a render its image requests plus the inspection that reads the image back. Every job is charged that worst case
before it is started; a job whose worst case would pass a cap is not started, and a queued render or inspection the tool will
not run is cancelled at once so the worker's cron cannot pick it up. The approval is also given to the worker itself: the run
creates a live-test allowance (POST /studio/allowance) with exactly the approved calls and images, and every project it makes
carries it, so the worker refuses any request past it on its own side - child jobs and the tick's included. The worker's ledger
(/studio/budget, text and images apart) is read before and after, so the report gives the actual spend beside the reservation.

Outputs stay private: --out (default smoke/, ignored by git) holds smoke.json, index.html, the drawn tiles and the export
bundles. Nothing is published, and the projects are archived at the end unless --keep.

  python3 tools/studio-smoke.py --key $AXIOM_KEY                                        # the estimate only; nothing runs
  python3 tools/studio-smoke.py --key $AXIOM_KEY --approve-calls 30                      # editable path, no images
  python3 tools/studio-smoke.py --key $AXIOM_KEY --approve-calls 60 --approve-renders 6 --size 1K --cases hoof,mca,synth
"""
import argparse, html, importlib.util, json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('studio_demo', os.path.join(HERE, 'studio-demo.py'))
demo = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(demo)
http, Stop, CASES, compose, current, marks_of, ensure_synth = demo.http, demo.Stop, demo.CASES, demo.compose, demo.current, demo.marks_of, demo.ensure_synth

RESIZE = ['story', 'linkedin', 'meta-square']
LEDGER = {'calls': 0, 'renders': 0, 'cap_calls': 0, 'cap_renders': 0, 'cancelled': [], 'jobs': [], 'allowance': None}
# the worker's attempt policy (GET /studio/budget -> policy); these defaults are the worker's own, used only for the estimate when it cannot be read
POLICY = {'text': {'perLogicalCall': 3, 'logicalCalls': {'default': 1, 'copy': 2, 'direct': 2, 'concepts': 2, 'sequence': 2}}, 'image': {'requestsPerJob': 4}}


def worst(stage):
    """The most a job of this stage can send (calls, images), every retry, fallback and job attempt included."""
    per = int(POLICY['text'].get('perLogicalCall') or 3); lc = POLICY['text'].get('logicalCalls') or {}
    n = lc.get(stage, lc.get('default', 1)); n = n if isinstance(n, int) else 1
    if stage == 'export':
        return 0, 0
    if stage == 'render':
        return per * (lc.get('inspect', 1) if isinstance(lc.get('inspect', 1), int) else 1), int(POLICY['image'].get('requestsPerJob') or 4)   # its inspection, its images
    return per * n, 0


def reserve(stage):
    """Charge one job at its worst case before it starts; refuse (False) when that would pass a cap."""
    if stage in ('export', 'inspect'):
        return True   # an export calls no model; an inspection was reserved with its render
    calls, images = worst(stage)
    if LEDGER['calls'] + calls > LEDGER['cap_calls'] or LEDGER['renders'] + images > LEDGER['cap_renders']:
        return False
    LEDGER['calls'] += calls; LEDGER['renders'] += images
    return True


def step(base, key, job_id, label, tries=90):
    for _ in range(tries):
        d = http(base, key, 'POST', '/studio/job/step', {'id': job_id})
        if 'job' not in d:
            raise Stop('step %s: %s %s' % (job_id, d.get('error', ''), d.get('detail', '')))
        j = d['job']
        if j['state'] in ('done', 'failed', 'cancelled'):
            LEDGER['jobs'].append({'id': j['id'], 'stage': j.get('stage'), 'state': j['state'], 'attempts': j.get('attempts'), 'error': j.get('error')})
            if j['state'] != 'done':
                print('  ! %s %s: %s' % (label, j['state'], j.get('error', '')))
            return j
        time.sleep(3 if 'another runner' in (j.get('note') or '') else 0.5)
    print('  ! %s did not finish in time' % label)
    return None


def job(base, key, pid, stage, inp, label, asset=None):
    if not reserve(stage):
        c, i = worst(stage)
        raise Stop('the approved budget cannot cover %s at its worst case (%d call%s, %d image%s, retries and fallbacks included); nothing further was started' % (stage, c, '' if c == 1 else 's', i, '' if i == 1 else 's'))
    j = http(base, key, 'POST', '/studio/job', {'project': pid, 'stage': stage, 'input': inp, 'asset': asset, 'idem': 'smoke:%s:%s:%d' % (pid, stage, int(time.time() * 1000))})['job']
    caps = j.get('caps') or {}
    if (caps.get('text') or 0) > worst(stage)[0] or (caps.get('image') or 0) > worst(stage)[1]:
        http(base, key, 'POST', '/studio/job/cancel', {'id': j['id']}); LEDGER['cancelled'].append(j['id'])
        raise Stop('the worker allows %s more than the policy said (%s); cancelled before it ran' % (stage, json.dumps(caps)))
    print('  running %s (%s)' % (stage, label))
    return step(base, key, j['id'], label)


def pump(base, key, pid):
    """Run what the worker queued (renders, then their inspections) inside the reservation; cancel the rest at once."""
    for _ in range(8):
        jobs = [j for j in http(base, key, 'GET', '/studio/jobs?project=' + pid)['jobs'] if j['state'] == 'queued' and j['id'] not in LEDGER['cancelled']]
        if not jobs:
            return
        for j in sorted(jobs, key=lambda x: x['created']):
            if not reserve(j['stage']):
                print('  ! %s %s cancelled: outside the approved budget' % (j['stage'], j['id']))
                LEDGER['cancelled'].append(j['id']); http(base, key, 'POST', '/studio/job/cancel', {'id': j['id']}); continue
            step(base, key, j['id'], j['stage'])


def ledger(base, key):
    try:
        return http(base, key, 'GET', '/studio/budget')
    except Stop:
        return {}


def export_check(base, key, pid, ids, out):
    ej = job(base, key, pid, 'export', {'assets': ids}, 'exporting what passed and was approved')
    res = (ej or {}).get('result') or {}
    got = sorted(x.get('asset') for x in res.get('included') or [])
    os.makedirs(out, exist_ok=True); files = []
    for k in list((res.get('files') or {}).values()) + [x['exportKey'] for x in res.get('included') or [] if x.get('exportKey')]:
        p = os.path.join(out, os.path.basename(k)); open(p, 'wb').write(http(base, key, 'GET', '/studio/file?key=' + urllib.request.quote(k, safe=''), raw=True)); files.append(p)
    return {'included': got, 'expected': sorted(ids), 'exact': got == sorted(ids), 'excluded': res.get('excluded') or [], 'files': files}


def editable(base, key, args, cid, rec):
    c = CASES[cid]; out = os.path.join(args.out, cid, 'editable'); os.makedirs(out, exist_ok=True)
    no_img = LEDGER['cap_renders'] == 0
    brief = dict(c['brief'], channels=c['channels'], deliverable='visual', campaignConfirmed=True, size=args.size, creationMode='editable')
    p = http(base, key, 'POST', '/studio/project', {'ns': c['ns'], 'campaign': c['campaign'], 'title': 'Smoke - ' + c['title'], 'brief': brief, 'allowance': LEDGER['allowance'], 'idem': 'smoke:%s:ed:%s' % (cid, LEDGER['allowance'])})
    pid = rec['editable'] = p['id']
    src = http(base, key, 'POST', '/studio/source', {'project': pid, 'kind': 'release', 'name': 'Smoke release', 'text': c['release']})
    job(base, key, pid, 'extract', {'source': src['id']}, 'reading the release')
    j = job(base, key, pid, 'copy', {'channels': c['channels'], 'deliverable': 'visual', 'size': args.size, 'render': not no_img, 'imagery': 'none' if no_img else None,
                                     'instruction': 'No photograph: the words, shapes and the mark carry it.' if no_img else ''}, 'writing and laying out the master')
    if not j or j['state'] != 'done':
        raise Stop('production failed: ' + ((j or {}).get('error') or 'no answer'))
    pump(base, key, pid)
    g = http(base, key, 'GET', '/studio/get?id=' + pid); master = g['assets'][0]
    rz = http(base, key, 'POST', '/studio/resize', {'asset': master['id'], 'presets': RESIZE}, ok_codes=(400, 409))
    rec['resized'] = [x.get('format') for x in (rz.get('assets') or rz.get('made') or [])] if not rz.get('_status') else ('refused: ' + str(rz.get('error')))
    comp = compose(base, key, args, pid, os.path.join(out, 'tiles'))
    rec['composed'] = [{'title': x.get('title'), 'format': x.get('format'), 'ok': (x.get('validation') or {}).get('ok'), 'blocking': (x.get('validation') or {}).get('blocking'), 'file': x.get('file')} for x in comp.get('composed') or []]
    if not comp.get('ok'):
        raise Stop('the tiles could not be drawn and measured here: ' + str(comp.get('error') or ''))
    g = http(base, key, 'GET', '/studio/get?id=' + pid)
    passed = [a for a in g['assets'] if (a.get('readiness') or {}).get('technical') == 'passed']
    for a in passed:
        for part in ('copy', 'design'):
            http(base, key, 'POST', '/studio/approve', {'asset': a['id'], 'part': part, 'decision': 'approve', 'reason': 'Smoke: %s checked against the brief and the kit' % part}, ok_codes=(409,))
    rec['editableExport'] = export_check(base, key, pid, [a['id'] for a in passed], os.path.join(out, 'bundle')) if passed else {'included': [], 'note': 'no tile passed its technical validation'}
    rec['formats'] = sorted(set(a['format'] for a in g['assets']))
    rec['marks'] = {a['title']: marks_of(current(a)) for a in g['assets']}
    print('  editable: %d tile%s in %s; %d passed validation; export exact: %s' % (len(g['assets']), '' if len(g['assets']) == 1 else 's', ', '.join(rec['formats']), len(passed), rec['editableExport'].get('exact')))


def finished(base, key, args, cid, rec):
    c = CASES[cid]; out = os.path.join(args.out, cid, 'finished'); os.makedirs(out, exist_ok=True)
    brief = dict(c['brief'], channels=c['channels'][:1], deliverable='visual', campaignConfirmed=True, size=args.size, creationMode='finished')
    p = http(base, key, 'POST', '/studio/project', {'ns': c['ns'], 'campaign': c['campaign'], 'title': 'Smoke (Full AI) - ' + c['title'], 'brief': brief, 'allowance': LEDGER['allowance'], 'idem': 'smoke:%s:fin:%s' % (cid, LEDGER['allowance'])})
    pid = rec['finished'] = p['id']
    j = job(base, key, pid, 'copy', {'channels': c['channels'][:1], 'deliverable': 'visual', 'size': args.size, 'render': True}, 'writing the words for one painting')
    if not j or j['state'] != 'done':
        rec['finishedResult'] = {'stopped': (j or {}).get('error') or 'no answer'}; return
    pump(base, key, pid)
    g = http(base, key, 'GET', '/studio/get?id=' + pid); a = g['assets'][0]; v = current(a); rd = a.get('readiness') or {}
    baked = rd.get('baked') or {}
    res = {'painted': bool(v.get('image')), 'model': ((v.get('image') or {}).get('meta') or {}).get('model'), 'marksSent': ((v.get('image') or {}).get('meta') or {}).get('marksSent'),
           'verified': baked.get('verified'), 'why': baked.get('why'), 'markProblem': baked.get('markProblem'), 'wordProblem': baked.get('wordProblem')}
    if baked.get('verified'):
        for part in ('copy', 'design'):
            http(base, key, 'POST', '/studio/approve', {'asset': a['id'], 'part': part, 'decision': 'approve', 'reason': 'Smoke: the reading verified the words and the mark'}, ok_codes=(409,))
        res['export'] = export_check(base, key, pid, [a['id']], os.path.join(out, 'bundle'))
    rec['finishedResult'] = res
    print('  Full AI: painted %s; words and mark read back: %s%s' % (res['painted'], res['verified'], (' (' + str(res['why']) + ')') if not res['verified'] else ''))


def write_index(args, recs, meta):
    rows = []
    for r in recs:
        comp = ''.join('<li>%s %s: %s</li>' % (html.escape(str(x['title'])), html.escape(str(x.get('format'))), 'passes' if x['ok'] else 'fails (' + html.escape(', '.join(x.get('blocking') or [])) + ')') for x in r.get('composed') or [])
        fin = r.get('finishedResult')
        rows.append('<section><h2>%s</h2><p>%s</p><ul>%s</ul><p>Editable export exact: %s</p><p>Full AI: %s</p></section>' % (
            html.escape(r['case']), html.escape(r.get('stopped') or 'completed'), comp, html.escape(str((r.get('editableExport') or {}).get('exact'))),
            html.escape(json.dumps(fin)) if fin else 'not run (no renders approved)'))
    page = '<!doctype html><meta charset="utf-8"><title>Studio smoke</title><body style="font:14px system-ui;margin:24px;max-width:960px"><h1>Studio smoke - %s</h1><p>Worker %s, build %s. Reserved %d calls / %d images of %d / %d approved. Ledger before %s, after %s.</p>%s</body>' % (
        html.escape(meta['at']), html.escape(meta['worker']), html.escape(str(meta.get('build'))), LEDGER['calls'], LEDGER['renders'], LEDGER['cap_calls'], LEDGER['cap_renders'],
        html.escape(json.dumps(meta.get('ledgerBefore', {}).get('today', meta.get('ledgerBefore')))), html.escape(json.dumps(meta.get('ledgerAfter', {}).get('today', meta.get('ledgerAfter')))), ''.join(rows))
    open(os.path.join(args.out, 'index.html'), 'w').write(page)


def estimate(cases, renders):
    """Typical: one call per logical call, one image per painting. Worst: every job at its policy cap."""
    img_cap = int(POLICY['image'].get('requestsPerJob') or 4)
    fin = min(renders // img_cap, len(cases)) if renders else 0   # one painting per case on the Full AI path, each reserved at its cap
    ex, cp, rn = worst('extract')[0], worst('copy')[0], worst('render')
    worst_calls = len(cases) * (ex + cp) + fin * (cp + rn[0])
    return {'typicalCalls': len(cases) * 2 + fin * 2, 'typicalRenders': fin, 'worstCalls': worst_calls, 'worstRenders': fin * rn[1]}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--key', required=True); ap.add_argument('--worker', default=demo.DEFAULT_WORKER); ap.add_argument('--out', default='smoke')
    ap.add_argument('--cases', default='hoof,mca,synth'); ap.add_argument('--size', default='1K', choices=['1K', '2K', '4K'])
    ap.add_argument('--approve-calls', type=int, default=0, help='the most model calls this run may reserve (worst case, retries included)')
    ap.add_argument('--approve-renders', type=int, default=0, help='the most images (worst case, retries included); 0 skips the Full AI path')
    ap.add_argument('--keep', action='store_true'); ap.add_argument('--no-compose', action='store_true')
    args = ap.parse_args(); base = args.worker.rstrip('/')
    cases = [c.strip() for c in args.cases.split(',') if c.strip()]
    bad = [c for c in cases if c not in CASES]
    if bad:
        raise SystemExit('unknown case: ' + ', '.join(bad))
    got = ledger(base, args.key); pol = got.get('policy') if isinstance(got, dict) else None
    if pol and pol.get('text') and pol.get('image'):
        POLICY['text'] = pol['text']; POLICY['image'] = pol['image']
    e = estimate(cases, args.approve_renders)
    print('Policy%s: a model call is sent at most %d times (retries included); a render sends at most %d image requests (retries and fallbacks included) and is read back by one inspection.' % (
        '' if pol else ' (the worker\'s defaults: /studio/budget could not be read)', int(POLICY['text'].get('perLogicalCall') or 3), int(POLICY['image'].get('requestsPerJob') or 4)))
    print('Estimate for %s: typically %d model calls and %d image%s; reserved at worst %d calls and %d images.' % (
        ', '.join(cases), e['typicalCalls'], e['typicalRenders'], '' if e['typicalRenders'] == 1 else 's', e['worstCalls'], e['worstRenders']))
    if args.approve_calls <= 0:
        print('Nothing was run. Approve a budget with --approve-calls N (and --approve-renders N for the Full AI path).')
        return
    if not pol:
        raise SystemExit('The worker publishes no attempt policy (/studio/budget has no policy): it predates S24 and cannot enforce an allowance. Nothing was run.')
    LEDGER['cap_calls'] = args.approve_calls; LEDGER['cap_renders'] = args.approve_renders
    al = http(base, args.key, 'POST', '/studio/allowance', {'label': 'smoke %s' % time.strftime('%Y-%m-%d %H:%M'), 'calls': args.approve_calls, 'images': args.approve_renders, 'hours': 4})
    LEDGER['allowance'] = (al.get('allowance') or {}).get('id')
    if not LEDGER['allowance']:
        raise SystemExit('The worker did not grant the allowance (%s). Nothing was run.' % json.dumps(al)[:200])
    print('Approved: at most %d model calls and %d images, retries and inspections included; the worker holds the same cap (allowance %s).' % (args.approve_calls, args.approve_renders, LEDGER['allowance']))
    st = http(base, args.key, 'GET', '/studio/status')
    meta = {'at': time.strftime('%Y-%m-%d %H:%M'), 'worker': base, 'build': st.get('build'), 'ledgerBefore': ledger(base, args.key)}
    os.makedirs(args.out, exist_ok=True); recs = []
    for cid in cases:
        rec = {'case': cid, 'ns': CASES[cid]['ns'], 'campaign': CASES[cid]['campaign']}
        print('== ' + CASES[cid]['title'])
        try:
            if cid == 'synth':
                ensure_synth(base, args.key)
            editable(base, args.key, args, cid, rec)
            if args.approve_renders > 0:
                finished(base, args.key, args, cid, rec)
        except Stop as ex:
            print('  ! stopped: %s' % ex); rec['stopped'] = str(ex)
        recs.append(rec)
        if not args.keep:
            for k in ('editable', 'finished'):
                if rec.get(k):
                    http(base, args.key, 'POST', '/studio/project/archive', {'id': rec[k]}, ok_codes=(400, 404, 409))
    sep, iso = demo.separation(base, args.key, recs)
    meta['ledgerAfter'] = ledger(base, args.key)
    write_index(args, recs, meta)
    try:
        # withdrawn at the end (nothing else may spend against it), and recorded as the worker holds it then
        meta['allowance'] = http(base, args.key, 'POST', '/studio/allowance/revoke', {'id': LEDGER['allowance']}).get('allowance')
    except Stop:
        pass
    json.dump({'meta': meta, 'policy': POLICY, 'reserved': {k: LEDGER[k] for k in ('calls', 'renders', 'cap_calls', 'cap_renders', 'allowance')}, 'jobs': LEDGER['jobs'], 'cancelled': LEDGER['cancelled'], 'cases': recs, 'separation': sep, 'isolation': iso}, open(os.path.join(args.out, 'smoke.json'), 'w'), indent=2)
    own = all(x['ok'] for x in sep); clean = all((v or {}).get('clean', True) for v in iso.values())
    ok = sum(1 for r in recs if not r.get('stopped'))
    print('Done: %d of %d case%s completed; marks each case\'s own: %s; isolation clean: %s; reserved %d calls and %d images of %d and %d. Open %s' % (
        ok, len(recs), '' if len(recs) == 1 else 's', own, clean, LEDGER['calls'], LEDGER['renders'], LEDGER['cap_calls'], LEDGER['cap_renders'], os.path.join(args.out, 'index.html')))
    if ok < len(recs) or not own or not clean:
        sys.exit(1)


if __name__ == '__main__':
    main()
