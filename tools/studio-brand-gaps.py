#!/usr/bin/env python3
"""What the Studio does not know about a client's brand, written as a request for approved information - and, only within
a call budget the operator approves, the reference analyses that are still missing.

Read-only by default. For the client and each campaign in its kit it reads GET /brand/workspace (read role) and turns
the readiness findings - blocking, gaps, conflicts, outdated - into one list a strategist can send the client: the files,
values and rules that are missing, and the contradictions only the client can settle. Nothing is invented to fill a gap;
a gap stays a question until approved material arrives and is filed through the Brand view or tools/brand-logo.py.

  python3 tools/studio-brand-gaps.py --ns mca --key $AXIOM_KEY                       # print the request
  python3 tools/studio-brand-gaps.py --ns mca --key $AXIOM_KEY --out requests/        # also write requests/brand-requests-mca.md
  python3 tools/studio-brand-gaps.py --ns mca --key $AXIOM_KEY --analyse --approve-calls 6

--analyse runs POST /studio/reference/analyse (full role, one model call each) for unanalysed references, never more
than --approve-calls (default 0: it says how many are waiting and spends nothing). The requests/ folder is gitignored:
a brand request names client material.
"""
import argparse, json, os, sys, urllib.request, urllib.error

DEFAULT_WORKER = 'https://newsaus.heshan-998.workers.dev'

# what the client is asked for, by readiness code: plain requests for approved material, never a guess at the answer
ASK = {
    'logo_missing': 'The approved client logo as supplied by the client (SVG, or PNG with a transparent background), with its colour versions.',
    'wordmark_missing': 'The approved {campaign} wordmark files, in every colour version the campaign uses.',
    'wordmark_unnamed': 'The named colour versions of the {campaign} wordmark (for example blue, white, black) and which is the default.',
    'wordmark_tones': 'A light and a dark version of the {campaign} wordmark, so a version that reads exists for every kind of background.',
    'fonts_missing': 'The approved typefaces (family names and weights) and, where licensed, the font files.',
    'palette_missing': 'The approved colour values (hex) for the primary, secondary, background and text colours.',
    'voice_missing': 'A short description of the voice: how the client sounds, what it never says.',
    'identity_note_missing': 'What makes {campaign} recognisable: its colours, devices, type and any element that must always appear.',
    'no_approved_reference': 'Two or three approved designs for {scope} that show the look the client signs off.',
    'placement_unobserved': 'The mark placement rule for {campaign} (corner, minimum size, clear space), or approved designs that show it.',
    'no_approved_facts': 'The figures {campaign} may quote, each with its source and date, approved for use.',
}


def call(base, key, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method='POST' if body is not None else 'GET', headers={'X-Axiom-Key': key, 'Content-Type': 'application/json', 'User-Agent': 'axiom-studio-brand-gaps/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors='replace')
        try:
            d = json.loads(raw or '{}')
        except Exception:
            d = {}
        raise SystemExit('%s %s -> HTTP %s %s' % ('POST' if body is not None else 'GET', path, e.code, (d.get('error', '') + ' ' + d.get('detail', '')).strip() or raw[:160]))


def requests_for(ns, kit, workspaces):
    """[(section, [lines])]: what to ask for, what to settle, what is already fine, per scope."""
    out = []; asked = set()
    for scope, ws in workspaces:
        camp = (ws.get('campaign') or {}); cname = camp.get('name') or camp.get('id') or ''
        rd = ws.get('readiness') or {}; lines = []
        for sev in ('blocking', 'gaps'):
            for g in rd.get(sev) or []:
                code = g.get('code', '')
                if code in ('references_unanalysed',):
                    continue
                key = (code, camp.get('id') if '{campaign}' in ASK.get(code, '') or code.startswith('wordmark') or code in ('placement_unobserved', 'no_approved_facts', 'identity_note_missing', 'no_approved_reference') else '')
                if key in asked:
                    continue
                asked.add(key)
                ask = ASK.get(code, g.get('text', '')).format(campaign=cname or 'the client', scope=cname or 'the client')
                lines.append(('NEEDED BEFORE PRODUCTION: ' if sev == 'blocking' else '') + ask + '  _(' + g.get('text', '') + ')_')
        for c in rd.get('conflicts') or []:
            lines.append('PLEASE CONFIRM: ' + c.get('text', ''))
        if lines:
            out.append((('Campaign: ' + cname) if cname else 'The client (all campaigns)', lines))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--ns', required=True); ap.add_argument('--key', required=True); ap.add_argument('--worker', default=DEFAULT_WORKER)
    ap.add_argument('--out', default=''); ap.add_argument('--json', action='store_true')
    ap.add_argument('--analyse', action='store_true'); ap.add_argument('--approve-calls', type=int, default=0)
    a = ap.parse_args(); base = a.worker.rstrip('/')
    kit = call(base, a.key, '/brand/kit?ns=' + a.ns).get('kit') or {}
    camps = [c for c in (kit.get('campaigns') or []) if c.get('active', True) is not False]
    workspaces = [('client', call(base, a.key, '/brand/workspace?ns=' + a.ns))] + [(c['id'], call(base, a.key, '/brand/workspace?ns=%s&campaign=%s' % (a.ns, c['id']))) for c in camps]
    # campaigns first: a mark one campaign requires is asked for there as NEEDED BEFORE PRODUCTION, not once as a general gap
    reqs = requests_for(a.ns, kit, workspaces[1:] + workspaces[:1])
    unanalysed = {}
    for _, ws in workspaces:
        for r in ws.get('references') or []:
            if not r.get('analysed') and r.get('id'):
                unanalysed[r['id']] = r.get('name') or r['id']
    if a.json:
        print(json.dumps({'ns': a.ns, 'requests': [{'scope': s, 'items': l} for s, l in reqs], 'unanalysed': unanalysed}, indent=2)); return
    name = kit.get('name') or a.ns
    md = ['# Brand information requested from %s' % name, '',
          'What the Studio does not hold yet, from the brand workspace on the live worker. Each line asks for approved material; nothing here has been filled in by assumption. Lines marked NEEDED BEFORE PRODUCTION stop a composition from being complete.', '']
    if not reqs:
        md.append('Nothing is missing that the workspace can detect.')
    for scope, lines in reqs:
        md.append('## ' + scope); md.append('')
        md.extend('- ' + l for l in lines); md.append('')
    md.append('## References the models read by name only'); md.append('')
    md.append(('%d reference%s not analysed: %s.' % (len(unanalysed), '' if len(unanalysed) == 1 else 's', ', '.join(list(unanalysed.values())[:8]))) if unanalysed else 'Every reference is analysed.')
    text = '\n'.join(md) + '\n'
    print(text)
    if a.out:
        os.makedirs(a.out, exist_ok=True); path = os.path.join(a.out, 'brand-requests-%s.md' % a.ns)
        with open(path, 'w') as f:
            f.write(text)
        print('written %s' % path)
    if a.analyse:
        ids = list(unanalysed.keys())
        if a.approve_calls <= 0:
            print('%d reference%s waiting for analysis; nothing spent. Re-run with --approve-calls %d (one extraction-model call each).' % (len(ids), '' if len(ids) == 1 else 's', len(ids)))
            return
        done = 0
        for rid in ids[:a.approve_calls]:
            d = call(base, a.key, '/studio/reference/analyse', {'id': rid}); done += 1
            an = d.get('analysis') or {}
            print('  %s %s: %s' % ('analysed' if d.get('ok') else 'NOT analysed', unanalysed[rid], an.get('summary', '')[:100] if d.get('ok') else an.get('error', '')))
        if len(ids) > done:
            print('%d left waiting: the approved budget was %d call%s.' % (len(ids) - done, a.approve_calls, '' if a.approve_calls == 1 else 's'))


if __name__ == '__main__':
    main()
