#!/usr/bin/env python3
"""
daily-brief.py - finish the queues and write the day's brief.

One command, run from a Mac with the access key, and the day is closed:

  1. Sentiment: every matched row still waiting for a verdict is judged
     (POST /sentiment/step, one Claude call of up to 20 rows per step).
  2. Narratives: every waiting row is placed (POST /narratives/step place),
     stale narratives are recounted (recount), and every narrative that has
     earned a name is named (name), one step per request.
  3. The brief: POST /brief/daily has Claude write today's intelligence brief
     from the alerts, narratives, stances, issues and headlines the worker
     holds, files it in the Mind, and returns it. It is saved here as
     Markdown, HTML and JSON, and the same brief shows at the top of AXIOM's
     front page.

Usage:
  python3 tools/daily-brief.py --key KEY                # drain, then write and save
  AXIOM_KEY=... python3 tools/daily-brief.py            # the key from the environment
  python3 tools/daily-brief.py --skip-queue             # just write today's brief
  python3 tools/daily-brief.py --only sentiment         # drain one queue and stop
  python3 tools/daily-brief.py --days 3 --out ~/Desktop # a three-day window, saved there

Each step stops on its own when nothing waits, when the day's Claude budget
is spent (SENTIMENT_DAILY_CALLS / NARRATIVE_DAILY_CALLS on the worker), or
when the Anthropic account's spend limit answers - the message says which.
Stdlib only. The output folder (default ./briefs) is gitignored: a brief is
client intelligence and stays out of the repository.
"""
import argparse, datetime, html, json, os, re, sys, time, urllib.error, urllib.request

WORKER = 'https://newsaus.heshan-998.workers.dev'
LIMIT_RX = re.compile(r'usage limit|spend limit|regain access|credit balance|billing', re.I)
BUDGET_RX = re.compile(r'daily budget|budget of \d+', re.I)


def call(worker, key, path, body=None, timeout=240):
    req = urllib.request.Request(worker.rstrip('/') + path, method='POST' if body is not None else 'GET',
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': 'axiom-daily-brief/1.0'})
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode() or '{}')
        except urllib.error.HTTPError as e:
            try:
                d = json.loads(e.read().decode() or '{}')
            except Exception:
                d = {}
            if e.code in (401, 403):
                sys.exit('the worker refused the key (%s): %s' % (e.code, d.get('detail') or d.get('error') or ''))
            if e.code == 404 and d.get('error') == 'not_found':
                sys.exit('the worker has no %s route yet: redeploy it (cd ~/Axiom && git pull && tools/deploy-worker.sh)' % path)
            if e.code == 404:
                return d
            last = '%s %s' % (e.code, d.get('detail') or d.get('error') or e.reason)
            if e.code < 500:
                return d or {'ok': False, 'error': last}
        except Exception as e:
            last = str(e)
        time.sleep(2 * (attempt + 1))
    return {'ok': False, 'error': 'request failed', 'detail': last or ''}


def say(s):
    print(s, flush=True)


def lines_of(d):
    for l in d.get('lines') or []:
        k = l.get('kind', 'info')
        if k in ('cmd', 'out', 'err', 'done'):
            say('    %s %s' % ({'cmd': '$', 'out': '>', 'err': '!', 'done': '*'}[k], l.get('text', '')))


def stop_reason(errors):
    for e in errors or []:
        if LIMIT_RX.search(e):
            return 'the Anthropic account spend limit answered (not an AXIOM budget): raise it in the Anthropic Console under Settings, Limits'
        if BUDGET_RX.search(e):
            return "the worker's daily Claude budget is spent (SENTIMENT_DAILY_CALLS / NARRATIVE_DAILY_CALLS raise it)"
    return ''


def drain_sentiment(worker, key, max_steps):
    say('SENTIMENT - judging every matched row that waits')
    st = call(worker, key, '/sentiment/status')
    if st.get('error') and not st.get('ok'):
        say('  could not read the status: %s' % (st.get('detail') or st.get('error'))); return False
    backlog = st.get('backlog', 0)
    b = st.get('budget') or {}
    say('  %s rows wait; %s of %s calls used today on %s' % (backlog, b.get('used', '?'), b.get('cap', '?'), b.get('model', '?')))
    if not backlog:
        return True
    judged = 0
    for i in range(max_steps):
        d = call(worker, key, '/sentiment/step', {'limit': 20})
        if d.get('error') and not d.get('classified'):
            say('  step failed: %s' % (d.get('detail') or d.get('error')))
            reason = stop_reason([d.get('detail') or d.get('error') or ''])
            if reason:
                say('  stopped: ' + reason)
            return False
        lines_of(d)
        judged += d.get('classified', 0)
        reason = stop_reason(d.get('errors'))
        if reason:
            say('  stopped: ' + reason); return False
        rem = d.get('backlog', 0)
        say('  step %d: %s judged, %s left' % (i + 1, d.get('classified', 0), rem))
        if not rem:
            break
        if not d.get('classified') and not d.get('calls'):
            say('  nothing more was taken this step; stopping'); break
    say('  %d rows judged in this run' % judged)
    return True


def drain_narratives(worker, key, max_steps):
    say('NARRATIVES - placing, recounting, naming')
    st = call(worker, key, '/narratives/status')
    if st.get('error') and not st.get('ok'):
        say('  could not read the status: %s' % (st.get('detail') or st.get('error'))); return False
    b = st.get('budget') or {}
    say('  %s rows wait to be placed, %s narratives live; %s of %s naming calls used today on %s' % (st.get('backlog', 0), st.get('live', 0), b.get('used', '?'), b.get('cap', '?'), b.get('model', '?')))
    placed = 0
    for i in range(max_steps):
        d = call(worker, key, '/narratives/step', {'what': 'place', 'scan': 100})
        if d.get('error') and not d.get('placed'):
            say('  place step failed: %s' % (d.get('detail') or d.get('error'))); return False
        placed += d.get('placed', 0)
        say('  place %d: %s scanned, %s placed (%s joined, %s started, %s set aside), %s left' % (i + 1, d.get('scanned', 0), d.get('placed', 0), d.get('joined', 0), d.get('started', 0), d.get('unanchored', 0), d.get('remaining', 0)))
        if not d.get('remaining') or not d.get('scanned'):
            break
    say('  %d rows placed in this run' % placed)
    for i in range(20):
        d = call(worker, key, '/narratives/step', {'what': 'recount'})
        if d.get('error') and not d.get('recounted'):
            say('  recount step failed: %s' % (d.get('detail') or d.get('error'))); break
        say('  recount %d: %s recounted, %s still stale' % (i + 1, d.get('recounted', 0), d.get('remaining', 0)))
        if not d.get('remaining') or not d.get('recounted'):
            break
    named = 0
    for i in range(max_steps):
        d = call(worker, key, '/narratives/step', {'what': 'name'})
        if d.get('error') and not d.get('named'):
            say('  name step failed: %s' % (d.get('detail') or d.get('error')))
            reason = stop_reason([d.get('detail') or d.get('error') or ''])
            if reason:
                say('  stopped: ' + reason)
            return False
        lines_of(d)
        named += d.get('named', 0)
        reason = stop_reason(d.get('errors'))
        if reason:
            say('  stopped: ' + reason); return False
        say('  name %d: %s named, %s alerts, %s still wait' % (i + 1, d.get('named', 0), d.get('alerts', 0), d.get('remaining', 0)))
        if not d.get('remaining'):
            break
        if not d.get('named') and not d.get('calls'):
            say('  nothing was named this step; stopping'); break
    say('  %d narratives named in this run' % named)
    return True


def esc(s):
    return html.escape(str(s or ''))


def brief_html(rec):
    """A standalone page from the same record - for a screen or a PDF (print it)."""
    b = rec.get('brief') or {}
    at = datetime.datetime.fromtimestamp(rec.get('at', 0) / 1000)
    out = ['<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><title>AXIOM daily brief - %s</title>' % esc(rec.get('day')),
           '<meta name="viewport" content="width=device-width,initial-scale=1">',
           '<style>body{font:15px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b1f24;max-width:880px;margin:36px auto;padding:0 24px}h1{font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin:0 0 4px}h2{font-size:26px;line-height:1.25;margin:6px 0 12px}h3{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin:28px 0 8px;border-top:1px solid #e5e7eb;padding-top:14px}h4{font-size:16px;margin:16px 0 4px}p{margin:0 0 10px}.meta{color:#6b7280;font-size:13px}.sum{font-size:17px}ul{margin:4px 0 8px;padding-left:20px}li{margin:0 0 4px}table{border-collapse:collapse;width:100%;font-size:14px;margin:6px 0 10px}th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #d1d5db;padding:6px 8px}td{padding:6px 8px;border-bottom:1px solid #eef0f2;vertical-align:top}td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}code{font-size:11px;color:#6b7280;background:#f3f4f6;padding:0 4px;border-radius:3px}.cols{display:grid;grid-template-columns:repeat(3,1fr);gap:0 20px}.cols b{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-top:6px}.foot{color:#6b7280;font-size:12.5px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:28px}@media print{body{margin:0;max-width:none}}</style></head><body>']
    out.append('<h1>AXIOM daily brief</h1><h2>%s</h2>' % esc(b.get('headline')))
    out.append('<p class="meta">%s. Curious Minds. The last %s hours. Evidence ids (N narrative, E entity, I issue, A alert, L headline) open in AXIOM.</p>' % (at.strftime('%A %-d %B %Y, %H:%M'), rec.get('hours')))
    out.append('<p class="sum">%s</p>' % esc(b.get('summary')))

    def ev(a):
        return (' <code>%s</code>' % esc(', '.join(a))) if a else ''

    def bullets(title, items):
        if not items:
            return ''
        return '<b>%s</b><ul>%s</ul>' % (esc(title), ''.join('<li>%s</li>' % esc(x) for x in items))
    if b.get('changed'):
        out.append('<h3>What changed</h3><ul>%s</ul>' % ''.join('<li><strong>%s</strong> %s%s</li>' % (esc(c.get('what')), esc(c.get('why')), ev(c.get('evidence'))) for c in b['changed']))
    if b.get('clients'):
        out.append('<h3>By client</h3>')
        for c in b['clients']:
            out.append('<h4>%s <code>%s</code></h4><p>%s%s</p><div class="cols">%s%s%s%s</div>' % (esc(c.get('client')), esc(c.get('ns')), esc(c.get('read')), ev(c.get('evidence')), bullets('Watch', c.get('watch')), bullets('Risks', c.get('risks')), bullets('Openings', c.get('openings')), bullets('Actions', c.get('actions'))))
    if b.get('narratives'):
        out.append('<h3>Narratives to watch</h3><table><tr><th>Narrative</th><th>Client</th><th>Rows</th><th>Toward client</th><th>Why it matters</th></tr>%s</table>' % ''.join(
            '<tr><td>%s <code>N:%s</code></td><td>%s</td><td class="n">%s (%s today)</td><td>%s</td><td>%s</td></tr>' % (esc(n.get('label')), esc(n.get('id')), esc(n.get('client') or '-'), n.get('n', 0), n.get('n24', 0), esc(n.get('stance')), esc(n.get('why'))) for n in b['narratives']))
    if b.get('sentiment'):
        out.append('<h3>Stances that moved</h3><table><tr><th>Who</th><th>Mentions</th><th>Net</th><th>Change</th><th>Direction</th><th>Why</th></tr>%s</table>' % ''.join(
            '<tr><td>%s <code>E:%s</code></td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td>%s</td><td>%s</td></tr>' % (esc(s.get('name')), esc(s.get('id')), s.get('n', 0), s.get('score'), 'new' if s.get('change') is None else ('%+.2f' % s['change']), esc(s.get('direction')), esc(s.get('why'))) for s in b['sentiment']))
    tail = bullets('Risks', b.get('risks')) + bullets('Actions', b.get('actions')) + bullets('Gaps in the evidence', b.get('gaps'))
    if tail:
        out.append('<h3>Risks, actions, gaps</h3><div class="cols">%s</div>' % tail)
    s = rec.get('stats') or {}
    out.append('<p class="foot">%s rows on client issues in the window; %s narratives live, %s moving; %s rows judged today%s; %s alert(s) awaiting a response; %s sources delivering. Written by %s.</p>' % (
        s.get('rows', 0), s.get('narrativesLive', 0), s.get('moving', 0), s.get('judged24', 0), (', %s waiting' % s['sentimentBacklog']) if s.get('sentimentBacklog') else '', s.get('alertsOpen', 0), s.get('sourcesDelivering', 0), esc(rec.get('model'))))
    out.append('</body></html>')
    return '\n'.join(out)


def write_brief(worker, key, days, mind, out_dir):
    say('BRIEF - writing today\'s brief (a minute or two)')
    d = call(worker, key, '/brief/daily', {'days': days, 'mind': mind}, timeout=400)
    lines_of(d)
    if not d.get('ok'):
        say('  the brief was not written: %s' % (d.get('detail') or d.get('error')))
        reason = stop_reason([d.get('detail') or ''])
        if reason:
            say('  ' + reason)
        return None
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.join(out_dir, 'brief-%s' % d['day'])
    with open(base + '.md', 'w', encoding='utf-8') as f:
        f.write(d.get('md') or '')
    with open(base + '.html', 'w', encoding='utf-8') as f:
        f.write(brief_html(d))
    with open(base + '.json', 'w', encoding='utf-8') as f:
        json.dump({k: v for k, v in d.items() if k not in ('lines', 'md')}, f, indent=1)
    say('  %s' % d['brief']['headline'])
    say('  saved %s.md, .html and .json%s' % (base, '; filed in the Mind as ' + d['mind'] if d.get('mind') else ''))
    say('  the same brief is at the top of the front page in AXIOM')
    return d


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''), help='full-access key (or AXIOM_KEY in the environment)')
    ap.add_argument('--worker', default=os.environ.get('AXIOM_WORKER', WORKER))
    ap.add_argument('--days', type=float, default=1, help='the window the brief covers, in days (default 1)')
    ap.add_argument('--out', default='briefs', help='folder for the saved brief (default ./briefs, gitignored)')
    ap.add_argument('--skip-queue', action='store_true', help='write the brief without draining the queues first')
    ap.add_argument('--only', choices=['sentiment', 'narratives', 'brief'], help='run one part only')
    ap.add_argument('--no-mind', action='store_true', help='do not file the brief in the Mind')
    ap.add_argument('--max-steps', type=int, default=400, help='steps per queue before stopping (default 400)')
    a = ap.parse_args(argv)
    if not a.key:
        sys.exit('give --key or set AXIOM_KEY (never paste it into a chat or a file in the repo)')
    t0 = time.time()
    if a.only == 'brief' or a.skip_queue:
        pass
    else:
        if a.only in (None, 'sentiment'):
            drain_sentiment(a.worker, a.key, a.max_steps)
        if a.only in (None, 'narratives'):
            drain_narratives(a.worker, a.key, a.max_steps)
    if a.only in (None, 'brief'):
        write_brief(a.worker, a.key, a.days, not a.no_mind, a.out)
    say('done in %ds' % (time.time() - t0))


if __name__ == '__main__':
    main()
