#!/usr/bin/env python3
"""
den-backtest.py - of the links in the analyst's filed reports, how many AXIOM held at the time (DEN.md, Phase 6).

This is the number that says whether collection is good enough. It reads a folder of exported reports (.docx .txt .md
.html, and .pdf when pdftotext is installed), takes every link each report cites and the report's date, and asks the
worker which of those addresses the archive holds and when each was first seen. A link counts as held when AXIOM first
saw it no later than the end of the day after the report's date (a report is written the morning after its window).

It reads only. It needs a read key and changes nothing, unless --save is given with a full key: then the summary (the
counts and up to sixty of the misses, no sentence of any report) is kept for the desk and shown in the Den's
Collection tab.

A report's date is taken from its file name (2026-11-10, 10-11-2026, 10 Nov 2026 ...) or from a "Reporting window"
line in its text. A report with no date it can read is counted against today, which is the lenient reading: say
--strict to leave such reports out.

The reports are client material. Keep them outside the repository: a folder inside it is refused.

Usage:
  python3 tools/den-backtest.py ~/Documents/briefs-aep --desk aep_au --key $AXIOM_KEY            # measure and print
  python3 tools/den-backtest.py ~/Documents/briefs-aep --desk aep_au --key $AXIOM_KEY --save     # and keep the result for the Den
"""
import argparse, datetime, importlib.util, json, os, re, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
WORKER = 'https://newsaus.heshan-998.workers.dev'
MONTHS = {m: i + 1 for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])}
SKIP = re.compile(r'(^|\.)(google\.com|docs\.google\.com|drive\.google\.com|goo\.gl|bit\.ly|tinyurl\.com|linktr\.ee|apple\.com|spotify\.com|w3\.org|schemas\.openxmlformats\.org|schemas\.microsoft\.com|purl\.org)$')


def _mine():
    spec = importlib.util.spec_from_file_location('den_mine', os.path.join(HERE, 'den-mine-reports.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


def report_date(name, text):
    """The report's day as a date, from its file name first, then its "Reporting window" line. None when neither says."""
    def mk(y, m, d):
        try: return datetime.date(int(y), int(m), int(d))
        except Exception: return None
    for src in (name, (re.search(r'(?i)reporting window[^\n]{0,80}', text or '') or [''])[0] if text else ''):
        s = src if isinstance(src, str) else src
        m = re.search(r'(20\d\d)[-_. ](\d{1,2})[-_. ](\d{1,2})', s)
        if m and mk(*m.groups()): return mk(*m.groups())
        m = re.search(r'(\d{1,2})[-_. ](\d{1,2})[-_. ](20\d\d)', s)
        if m and mk(m.group(3), m.group(2), m.group(1)): return mk(m.group(3), m.group(2), m.group(1))
        ms = list(re.finditer(r'(\d{1,2})(?:st|nd|rd|th)?[-_. ]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_., ]*(20\d\d)', s, re.I))
        if ms and mk(ms[-1].group(3), MONTHS[ms[-1].group(2).lower()], ms[-1].group(1)): return mk(ms[-1].group(3), MONTHS[ms[-1].group(2).lower()], ms[-1].group(1))
    return None


def links_of(text):
    out = []
    for u in re.findall(r'https?://[^\s<>"\')\]]+', text or ''):
        u = u.rstrip('.,;')
        h = re.sub(r'^(www|m|mobile)\.', '', urllib.parse.urlsplit(u).hostname or '')
        if not h or '.' not in h or SKIP.search(h): continue
        if u not in out: out.append(u)
    return out


def read_reports(folder, strict=False):
    mine = _mine(); out = []; undated = []
    files = sorted(os.path.join(dp, f) for dp, _, fs in os.walk(folder) for f in fs if os.path.splitext(f)[1].lower() in ('.docx', '.txt', '.md', '.html', '.htm', '.pdf'))
    for path in files:
        text = mine.text_of(path)
        if len(text.strip()) < 200: continue
        day = report_date(os.path.basename(path), text)
        if not day:
            undated.append(os.path.basename(path))
            if strict: continue
        out.append({'name': os.path.basename(path), 'day': day, 'links': links_of(text)})
    return out, undated


def call(url, key, body=None, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET', headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': 'axiom-den-backtest/1'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode() or '{}')
        except Exception: return {'ok': False, 'error': 'http_%d' % e.code}


def measure(reports, worker, key, send=call, now=None):
    """Ask the worker about every link, twenty at a time. Returns the summary the Den shows."""
    worker = worker.rstrip('/'); now = now or datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    by = {}; layers = {}; misses = []; links = held = 0
    for rep in reports:
        # the end of the day after the report's date, in Sydney (UTC+10 is the stricter of its two offsets)
        cutoff = (datetime.datetime.combine(rep['day'], datetime.time()) + datetime.timedelta(days=2) - datetime.timedelta(hours=10)) if rep['day'] else now
        cut_ms = int((cutoff - datetime.datetime(1970, 1, 1)).total_seconds() * 1000)
        for i in range(0, len(rep['links']), 20):
            part = rep['links'][i:i + 20]
            got = send(worker + '/den/held?' + '&'.join('u=' + urllib.parse.quote(u, safe='') for u in part), key)
            if not got.get('ok'): raise SystemExit('The worker refused the lookup: %s %s' % (got.get('error') or '', got.get('detail') or ''))
            for r in got.get('results') or []:
                links += 1; ch = r.get('channel') or 'news'; c = by.setdefault(ch, {'links': 0, 'held': 0}); c['links'] += 1
                ok = bool(r.get('held')) and int(r.get('seen') or 0) <= cut_ms
                if ok:
                    held += 1; c['held'] += 1
                    for l in (r.get('layers') or [0]): layers[str(l)] = layers.get(str(l), 0) + 1
                else: misses.append({'url': r.get('url'), 'channel': ch, 'report': rep['name'], 'late': bool(r.get('held'))})
    days = sorted(r['day'] for r in reports if r['day'])
    return {'reports': len(reports), 'links': links, 'held': held, 'share': round(held * 100.0 / links, 1) if links else 0.0, 'byChannel': by, 'byLayer': layers,
            'period': ('%s to %s' % (days[0].isoformat(), days[-1].isoformat())) if days else '', 'misses': misses}


def run(folder, desk, worker, key, save=False, strict=False, send=call, out=print):
    mine = _mine()
    if mine.inside_repo(folder): raise SystemExit('That folder is inside the AXIOM repository. Reports are client material and never go there: move them somewhere else and point this at that folder.')
    folder = os.path.expanduser(folder)
    if not os.path.isdir(folder): raise SystemExit('No such folder: ' + folder)
    if not key: raise SystemExit('A key is needed to ask the worker what it holds (--key, or AXIOM_KEY). A read key is enough unless --save.')
    reports, undated = read_reports(folder, strict)
    if not reports: raise SystemExit('No report could be read in that folder.')
    if undated: out('%d report%s had no date this could read (%s): %s.' % (len(undated), '' if len(undated) == 1 else 's', ', '.join(undated[:4]), 'left out (--strict)' if strict else 'counted against today, the lenient reading'))
    r = measure(reports, worker, key, send)
    out('%d reports, %d links. AXIOM held %d of them in time: %.1f%%.' % (r['reports'], r['links'], r['held'], r['share']))
    for ch in sorted(r['byChannel'], key=lambda k: -r['byChannel'][k]['links']):
        c = r['byChannel'][ch]; out('  %-10s %4d of %4d  %5.1f%%' % (ch, c['held'], c['links'], c['held'] * 100.0 / c['links'] if c['links'] else 0))
    if r['byLayer']: out('  held by layer: ' + ', '.join('layer %s: %d' % (k if k != '0' else 'unrecorded', v) for k, v in sorted(r['byLayer'].items())))
    late = sum(1 for m in r['misses'] if m['late'])
    out('%d not held%s. The first of them:' % (len(r['misses']), (' (%d of those arrived later than the report)' % late) if late else ''))
    for m in r['misses'][:25]: out('  %-10s %s%s' % (m['channel'], m['url'], '  (late)' if m['late'] else ''))
    if save:
        got = send(worker.rstrip('/') + '/den/backtest', key, {'desk': desk, 'result': {'reports': r['reports'], 'links': r['links'], 'held': r['held'], 'period': r['period'], 'byChannel': r['byChannel'], 'byLayer': r['byLayer'], 'misses': [{'url': m['url'], 'channel': m['channel']} for m in r['misses'][:60]]}})
        if not got.get('ok'): raise SystemExit('The result was measured but not saved: %s %s' % (got.get('error') or '', got.get('detail') or ''))
        out('Saved for the %s desk: it shows in the Den\'s Collection tab.' % desk)
    else:
        out('Nothing was saved. Add --save (with a full key) to keep this result for the Den.')
    return r


def main(argv=None):
    ap = argparse.ArgumentParser(description='of the links in filed reports, how many AXIOM held at the time')
    ap.add_argument('folder'); ap.add_argument('--desk', required=True, help='the desk the result is for, e.g. aep_au'); ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--worker', default=WORKER); ap.add_argument('--save', action='store_true'); ap.add_argument('--strict', action='store_true')
    a = ap.parse_args(argv)
    run(a.folder, a.desk.lower(), a.worker, a.key, a.save, a.strict)


if __name__ == '__main__':
    main()
