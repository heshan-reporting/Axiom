#!/usr/bin/env python3
"""
den-import.py - newsletters and monitoring-service exports into AXIOM, for one
client's desk (DEN.md, Phase 4).

  eml=<folder>      subscriber newsletters saved as .eml files. Each message is one item, filed under its source in
                    the registry (--source), which must be set to access "newsletter" and cleared in the Sources
                    view: a newsletter is subscriber content, so its text is kept for the team and served to no one else.
  monitor=<csv>     an export from the media-monitoring service. Each row is one item: headline, outlet, date, link
                    and the service's own short excerpt. Columns are found by name, whatever the export calls them.

It prints what it would send and sends nothing without --apply. With --apply it posts to POST /den/import and
prints what was new to AXIOM and what AXIOM already held - which, for a monitoring export, is a measure of coverage.

Usage:
  python3 tools/den-import.py eml=~/Downloads/newsletters --source capitalbrief --ns aep --key $AXIOM_KEY [--apply]
  python3 tools/den-import.py monitor=export.csv --ns aep --key $AXIOM_KEY [--apply]
"""
import argparse, csv, email, email.policy, html, io, json, os, re, sys, urllib.request
from email.utils import parsedate_to_datetime

WORKER = 'https://newsaus.heshan-998.workers.dev'
COLS = {'title': ('title', 'headline', 'heading', 'article title', 'document title'), 'url': ('url', 'link', 'article url', 'permalink', 'source url'),
        'ts': ('date', 'published', 'publish date', 'published date', 'time', 'date published'), 'outlet': ('source', 'outlet', 'publication', 'source name', 'media outlet'),
        'text': ('hit sentence', 'summary', 'excerpt', 'snippet', 'opening text', 'description', 'content')}


def strip_html(s):
    s = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', s or '')
    s = re.sub(r'(?i)<br\s*/?>|</p>|</div>|</li>|</h\d>', '\n', s)
    return re.sub(r'[ \t]+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def from_eml(folder):
    items = []
    for fn in sorted(os.listdir(os.path.expanduser(folder))):
        if not fn.lower().endswith('.eml'):
            continue
        with open(os.path.join(os.path.expanduser(folder), fn), 'rb') as f:
            m = email.message_from_binary_file(f, policy=email.policy.default)
        body = m.get_body(preferencelist=('plain', 'html'))
        raw = body.get_content() if body else ''
        text = strip_html(raw) if (body and body.get_content_type() == 'text/html') else str(raw)
        text = re.sub(r'\n{3,}', '\n\n', text).strip()
        try:
            ts = int(parsedate_to_datetime(m['date']).timestamp() * 1000)
        except Exception:
            ts = 0
        title = re.sub(r'\s+', ' ', str(m['subject'] or '')).strip()
        if title and len(text) >= 200:
            items.append({'title': title, 'ts': ts, 'text': text[:60000]})      # the sender's address and name are not read
    return items


def from_monitor(path):
    with open(os.path.expanduser(path), newline='', encoding='utf-8-sig', errors='replace') as f:
        sample = f.read(4096); f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
        except Exception:
            dialect = csv.excel
        rd = csv.DictReader(f, dialect=dialect)
        names = {str(n or '').strip().lower(): n for n in (rd.fieldnames or [])}
        col = {k: next((names[a] for a in al if a in names), None) for k, al in COLS.items()}
        if not col['title'] or not col['url']:
            raise SystemExit('this export has no headline or link column that is recognised (found: %s)' % ', '.join(rd.fieldnames or []))
        items = []
        for r in rd:
            g = lambda k: str(r.get(col[k]) or '').strip() if col[k] else ''
            if g('title') and g('url').startswith('http'):
                items.append({'title': g('title'), 'url': g('url'), 'ts': g('ts'), 'outlet': g('outlet'), 'text': g('text')[:500]})
        return items


def post(url, key, body, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST', headers={'X-Axiom-Key': key, 'Content-Type': 'application/json', 'User-Agent': 'axiom-den/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode() or '{}')
        except Exception: return {'ok': False, 'error': 'http_%s' % e.code}


def run(kind, items, ns, source, worker, key, apply, send=post, out=print):
    out('%s: %d items for %s%s' % (kind, len(items), ns, (' under ' + source) if source else ''))
    for it in items[:5]:
        out('  %s%s' % (it['title'][:90], ('  <' + it['url'][:60] + '>') if it.get('url') else ''))
    if len(items) > 5: out('  ... and %d more' % (len(items) - 5))
    if not apply:
        out('nothing was sent. Add --apply to file these.'); return {'sent': 0}
    tot = {'sent': 0, 'added': 0, 'held': 0, 'gated': 0, 'on_topic': 0}
    for i in range(0, len(items), 200):
        r = send(worker.rstrip('/') + '/den/import', key, {'ns': ns, 'kind': kind, 'source': source, 'items': items[i:i + 200]})
        if not r.get('ok'):
            raise SystemExit('the worker refused: %s - %s' % (r.get('error'), r.get('detail')))
        tot['sent'] += len(items[i:i + 200])
        for k in ('added', 'held', 'gated', 'on_topic'): tot[k] += int(r.get(k) or 0)
    out('%d sent: %d new to AXIOM, %d it already held%s; %d on %s\'s issues' % (tot['sent'], tot['added'], tot['held'], (', %d with their text filed for the team' % tot['gated']) if kind == 'newsletter' else '', tot['on_topic'], ns))
    return tot


def main(argv=None):
    ap = argparse.ArgumentParser(description='newsletters and monitoring exports into AXIOM')
    ap.add_argument('what', help='eml=<folder> or monitor=<csv>'); ap.add_argument('--ns', required=True); ap.add_argument('--source', default='')
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', '')); ap.add_argument('--worker', default=WORKER); ap.add_argument('--apply', action='store_true')
    a = ap.parse_args(argv)
    name, _, path = a.what.partition('=')
    if name not in ('eml', 'monitor') or not path.strip():
        sys.exit('say what to import: eml=<folder> or monitor=<csv>')
    for v in (path, a.source):
        if re.search(r'[<>]', v or ''):                 # "<folder>" and "<source id>" in the instructions stand for a real value
            sys.exit('"%s" is the placeholder from the instructions, not a real value: put the real folder, file or source id in its place' % v)
    full = os.path.expanduser(path)
    if name == 'eml':
        if not a.source: sys.exit('a newsletter is imported under its source: --source followed by the id shown under its name in the Sources view')
        if not os.path.isdir(full): sys.exit('No such folder: %s (eml= takes the folder that holds the saved .eml files)' % path)
        n = sum(1 for fn in os.listdir(full) if fn.lower().endswith('.eml'))
        if not n: sys.exit('no .eml files in %s: save each newsletter from the mail app as a .eml file into that folder first' % path)
        kind, items = 'newsletter', from_eml(path)
        if not items: sys.exit('%d .eml files in %s, none with a subject and at least 200 characters of text' % (n, path))
    else:
        if not os.path.isfile(full): sys.exit('No such file: %s (monitor= takes the CSV file the monitoring service exported)' % path)
        kind, items = 'monitor', from_monitor(path)
    if a.apply and not a.key: sys.exit('--apply needs --key or AXIOM_KEY')
    run(kind, items, a.ns, a.source, a.worker, a.key, a.apply)
    return 0


if __name__ == '__main__':
    sys.exit(main())
