#!/usr/bin/env python3
"""The Studio golden set: past briefs re-run through the live Studio and diffed against what the team approved.

A golden case is a folder of JSON files outside the repo (they hold client material):

  cases/<name>.json     {"ns":"mca","campaign":"hoof","title":"...","brief":{"objective":"...","message":"..."},
                         "source":"the release text (optional)","channels":["linkedin","facebook"],"deliverable":"copy",
                         "instruction":"optional clear instruction"}
  baseline/<name>.json  what the last accepted run produced (written by --accept)

The run creates a project per case on the live worker (title prefixed GOLDEN), adds and extracts the source,
runs the copy stage with renders off, and records per channel the headline, support, CTA, caption, the checks
and the context snapshot. It then compares with the baseline: fields that changed, checks that appeared or
disappeared, rules and facts counts that moved. Exit code 1 when anything differs, so a prompt or model
change is seen before it reaches the team. Every run spends model calls: it counts against STUDIO_DAILY_CALLS.

  python3 tools/studio-golden.py <folder> --key $AXIOM_KEY            run and diff
  python3 tools/studio-golden.py <folder> --key $AXIOM_KEY --accept   run and write the baseline
  --worker URL (default the production worker)  --only name  --archive (archive the GOLDEN projects afterwards)
"""
import argparse, json, os, sys, time, urllib.request, urllib.error

DEFAULT_WORKER = 'https://newsaus.heshan-998.workers.dev'


def http(base, key, method, path, body=None):
    # Cloudflare refuses Python's default User-Agent with an empty 403, so name the tool.
    req = urllib.request.Request(base + path, method=method, headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': 'axiom-studio-golden/1.0'},
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors='replace')
        try:
            d = json.loads(raw or '{}')
        except Exception:
            d = {}
        why = (d.get('error', '') + ' ' + d.get('detail', '')).strip() or ('(no JSON body: %s)' % (raw[:160].replace('\n', ' ') or 'empty'))
        raise SystemExit('%s %s -> HTTP %s %s' % (method, path, e.code, why))


def step_until_done(base, key, job_id, label):
    for _ in range(40):
        d = http(base, key, 'POST', '/studio/job/step', {'id': job_id})
        if 'job' not in d:   # a long step answers with spaces while it runs, so a later failure arrives as a JSON error body
            raise SystemExit('step %s: %s %s' % (job_id, d.get('error', ''), d.get('detail', '')))
        j = d['job']
        if j['state'] in ('done', 'failed', 'cancelled'):
            if j['state'] != 'done':
                raise SystemExit('%s failed: %s' % (label, j.get('error', '')))
            return j
        time.sleep(3 if (j.get('note') or '').find('another runner') >= 0 else 0.6)
    raise SystemExit(label + ': did not finish in time')


def run_case(base, key, name, case):
    p = http(base, key, 'POST', '/studio/project', {'ns': case['ns'], 'campaign': case.get('campaign', ''), 'title': 'GOLDEN ' + case.get('title', name),
                                                    'brief': case.get('brief', {}), 'idem': 'golden:%s:%d' % (name, int(time.time()))})
    pid = p['id']
    if case.get('source'):
        s = http(base, key, 'POST', '/studio/source', {'project': pid, 'kind': 'release', 'name': name + ' source', 'text': case['source']})
        j = http(base, key, 'POST', '/studio/job', {'project': pid, 'stage': 'extract', 'input': {'source': s['id']}, 'idem': 'golden-extract:' + pid})['job']
        step_until_done(base, key, j['id'], name + ' extract')
    j = http(base, key, 'POST', '/studio/job', {'project': pid, 'stage': 'copy', 'input': {'channels': case.get('channels', ['linkedin']), 'deliverable': case.get('deliverable', 'copy'),
                                                                                         'instruction': case.get('instruction', ''), 'render': False}, 'idem': 'golden-copy:' + pid})['job']
    done = step_until_done(base, key, j['id'], name + ' copy')
    g = http(base, key, 'GET', '/studio/get?id=' + pid)
    out = {'project': pid, 'model': done.get('result', {}).get('model', ''), 'assets': {}}
    for a in g['assets']:
        v = a['versions'][-1]
        out['assets'][a['channel']] = {'copy': {k: v['copy'].get(k, '') for k in ('headline', 'support', 'cta', 'caption', 'alt')},
                                       'checks': sorted('%s:%s' % (c['state'], c['text']) for c in v.get('checks', [])),
                                       'rules': len((v.get('context', {}).get('rules') or {}).get('copy', [])), 'facts': v.get('context', {}).get('facts', 0), 'examples': v.get('context', {}).get('examples', 0)}
    return out


def diff(name, base, now):
    lines = []
    if base.get('model') != now.get('model'):
        lines.append('  model %s -> %s' % (base.get('model'), now.get('model')))
    for ch in sorted(set(base.get('assets', {})) | set(now.get('assets', {}))):
        b, n = base.get('assets', {}).get(ch), now.get('assets', {}).get(ch)
        if not b or not n:
            lines.append('  %s: %s' % (ch, 'new in this run' if not b else 'missing from this run')); continue
        for k in ('headline', 'support', 'cta', 'caption', 'alt'):
            if b['copy'].get(k) != n['copy'].get(k):
                lines.append('  %s.%s changed\n    was: %s\n    now: %s' % (ch, k, (b['copy'].get(k) or '')[:160], (n['copy'].get(k) or '')[:160]))
        gone = sorted(set(b['checks']) - set(n['checks'])); new = sorted(set(n['checks']) - set(b['checks']))
        if gone: lines.append('  %s checks gone: %s' % (ch, ', '.join(gone)))
        if new: lines.append('  %s checks new: %s' % (ch, ', '.join(new)))
        for k in ('rules', 'facts', 'examples'):
            if b.get(k) != n.get(k): lines.append('  %s %s in context: %s -> %s' % (ch, k, b.get(k), n.get(k)))
    return lines


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('folder'); ap.add_argument('--key', required=True); ap.add_argument('--worker', default=DEFAULT_WORKER)
    ap.add_argument('--accept', action='store_true'); ap.add_argument('--only'); ap.add_argument('--archive', action='store_true')
    a = ap.parse_args()
    base = a.worker.rstrip('/'); cases_dir = os.path.join(a.folder, 'cases'); base_dir = os.path.join(a.folder, 'baseline')
    if not os.path.isdir(cases_dir):
        raise SystemExit('no cases folder: ' + cases_dir)
    os.makedirs(base_dir, exist_ok=True)
    names = sorted(f[:-5] for f in os.listdir(cases_dir) if f.endswith('.json') and (not a.only or f[:-5] == a.only))
    if not names:
        raise SystemExit('no cases')
    budget = http(base, a.key, 'GET', '/studio/budget')
    print('%d case(s); Studio model calls today %s of %s; creative %s, extract %s' % (len(names), budget.get('used'), budget.get('cap'), budget['models']['creative'], budget['models']['extract']))
    differing = 0; projects = []
    for name in names:
        case = json.load(open(os.path.join(cases_dir, name + '.json')))
        print('== ' + name + ' (' + case['ns'] + ', ' + ', '.join(case.get('channels', ['linkedin'])) + ')')
        now = run_case(base, a.key, name, case); projects.append(now['project'])
        bp = os.path.join(base_dir, name + '.json')
        if a.accept or not os.path.exists(bp):
            json.dump(now, open(bp, 'w'), indent=2); print('  baseline ' + ('written' if a.accept else 'created (no baseline existed)'))
            continue
        lines = diff(name, json.load(open(bp)), now)
        if lines:
            differing += 1; print('\n'.join(lines))
        else:
            print('  same as the baseline')
    if a.archive:
        for pid in projects:
            http(base, a.key, 'POST', '/studio/project/archive', {'id': pid})
        print('%d GOLDEN project(s) archived' % len(projects))
    print('%d of %d case(s) differ from the baseline' % (differing, len(names)))
    sys.exit(1 if differing else 0)


if __name__ == '__main__':
    main()
