#!/usr/bin/env python3
"""
reach-agent.py - the collector that turns AXIOM's Sweep button into a sweep on
this machine, and streams every command and its answer back to the app.

How it works. Pressing Sweep in AXIOM creates a JOB in the worker. Sources the
worker can reach itself (LinkedIn and Meta through their APIs, Reddit when
Reddit allows it) run there. Sources that need a logged-in session - X above
all, and Reddit in practice - are left queued. This agent, running on your Mac,
claims those jobs, runs the collectors, and posts each command and its result
back to the job's log, which the Signals console in AXIOM tails live. Rows are
filed through /archive/add exactly as the worker would write them. No handles,
usernames or display names are ever stored.

Usage (on the Mac, from the repo):
  python3 tools/reach-agent.py --key $AXIOM_KEY            # stay connected, take jobs as they come
  python3 tools/reach-agent.py --key $AXIOM_KEY --once     # take one job and exit
  python3 tools/reach-agent.py --install-launchd           # keep it running in the background
  python3 tools/reach-agent.py --uninstall-launchd

Needs: rdt (Reddit) and/or twitter (X) on PATH, signed in. With Playwright
installed (pip install playwright && playwright install chromium) it also takes
`render` jobs: a source's listing page, or one article, read through a real
browser for the sites that build their pages in JavaScript. It reports which
collectors are available when it connects, and AXIOM shows that in Signals.
"""
import argparse, datetime, html as htmlmod, importlib.util, json, os, re, shutil, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
LABEL = 'com.curiousminds.axiom.reach-agent'


def _load(name, filename):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


rr = _load('reach_reddit', 'reach-reddit.py')
rx = _load('reach_x', 'reach-x.py')
WORKER = rr.WORKER


class Stream:
    """Log lines back to the job, in small batches. Every command the collector
    runs and every answer it gets shows up in the app while it happens."""

    def __init__(self, worker, key, job, echo=True, flush_every=6, flush_after=2.0):
        self.worker, self.key, self.job, self.echo = worker, key, job, echo
        self.buf, self.last = [], time.time()
        self.flush_every, self.flush_after = flush_every, flush_after

    def __call__(self, kind, text):
        text = str(text)
        if self.echo:
            print(('  ' if kind == 'out' else '') + text, flush=True)
        self.buf.append({'k': kind, 't': text[:1200]})
        if len(self.buf) >= self.flush_every or (time.time() - self.last) > self.flush_after:
            self.flush()

    def flush(self):
        if not self.buf or not self.job:
            self.buf = []
            return
        lines, self.buf, self.last = self.buf, [], time.time()
        try:
            rr.http_json(self.worker.rstrip('/') + '/bridge/log', self.key, {'job': self.job, 'lines': lines}, timeout=20)
        except Exception as e:
            print('  (log post failed: %s)' % e, file=sys.stderr)


def have(binary):
    return shutil.which(binary) is not None


def have_playwright():
    try:
        import playwright.sync_api  # noqa: F401
        return True
    except Exception:
        return False


def collectors():
    """Which sources this machine can actually collect, checked not assumed."""
    out = []
    if have('rdt'): out.append('reddit')
    if have('twitter'): out.append('x')
    if have_playwright(): out.append('render')
    return out


# ---- a real browser, for pages built in JavaScript --------------------------
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
FT_MIN = 600


def render_html(url, wait_ms=2500):
    """Load a page in headless Chromium and return (html, final_url)."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page(user_agent=UA, viewport={'width': 1280, 'height': 2200})
            page.route('**/*', lambda route: route.abort() if route.request.resource_type in ('image', 'media', 'font') else route.continue_())
            page.goto(url, wait_until='domcontentloaded', timeout=45000)
            try:
                page.wait_for_load_state('networkidle', timeout=15000)
            except Exception:
                pass
            page.wait_for_timeout(wait_ms)
            return page.content(), page.url
        finally:
            browser.close()


def strip_tags(s):
    s = re.sub(r'<br\s*/?>', ' ', s or '', flags=re.I)
    s = re.sub(r'<[^>]*>', '', s)
    return re.sub(r'\s+', ' ', htmlmod.unescape(s)).strip()


def listing_links(html_text, base):
    """The worker's listingLinks, in Python: article-shaped links on a listing page."""
    out, seen = [], set()
    host = re.sub(r'^www\.', '', urllib.parse.urlparse(base).netloc)
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\'#?]+)[^"\']*["\'][^>]*>(.*?)</a>', html_text, flags=re.I | re.S):
        text = strip_tags(m.group(2))
        if len(text) < 28 or len(text) > 220: continue
        u = urllib.parse.urlparse(urllib.parse.urljoin(base, m.group(1)))
        if re.sub(r'^www\.', '', u.netloc) != host: continue
        segs = [s for s in u.path.split('/') if s]
        slug = segs[-1] if segs else ''
        arty = (len(slug.split('-')) >= 4 or re.search(r'\d{4}/\d{2}', u.path) or re.search(r'/\d{5,}', u.path)
                or re.search(r'/(news|story|stories|article|articles|politics|media-releases?|media_releases?|statements?|releases?|speech|speeches|opinion|analysis|latest_news|latest-news|newsroom)/', u.path + '/', flags=re.I))
        if not arty or len(segs) < 2: continue
        key = u.scheme + '://' + u.netloc + u.path
        if key in seen: continue
        seen.add(key)
        out.append({'title': text, 'link': key})
        if len(out) >= 60: break
    return out


def extract_article(html_text):
    """Title and body text: JSON-LD articleBody, then <article> paragraphs, then the page's paragraphs."""
    title = strip_tags((re.search(r'<title[^>]*>(.*?)</title>', html_text, flags=re.I | re.S) or [None, ''])[1] if re.search(r'<title', html_text, flags=re.I) else '')
    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html_text, flags=re.I | re.S):
        try:
            d = json.loads(m.group(1).strip())
        except Exception:
            continue
        stack = [d]
        while stack:
            x = stack.pop()
            if isinstance(x, list): stack.extend(x); continue
            if not isinstance(x, dict): continue
            if x.get('@graph'): stack.append(x['@graph'])
            body = x.get('articleBody')
            if isinstance(body, str) and len(strip_tags(body)) >= FT_MIN:
                return str(x.get('headline') or title), strip_tags(body)[:12000]
    body = re.sub(r'<(script|style|nav|header|footer|aside|form|figure|figcaption|button|noscript|iframe|svg)\b.*?</\1>', ' ', html_text, flags=re.I | re.S)
    def paras(frag):
        ps = [strip_tags(p) for p in re.findall(r'<p\b[^>]*>(.*?)</p>', frag, flags=re.I | re.S)]
        return '\n\n'.join(p for p in ps if len(p) >= 40)[:12000]
    best = ''
    for art in re.findall(r'<article\b.*?</article>', body, flags=re.I | re.S):
        t = paras(art)
        if len(t) > len(best): best = t
    if len(best) < FT_MIN:
        t = paras(body)
        if len(t) > len(best): best = t
    return title, best


def tag_issues(text):
    return [i for i, rx in (getattr(rr, 'ISSUES', None) or []) if rx.search(text or '')]


# ---- the jobs ---------------------------------------------------------------
def job_reddit(worker, key, params, log):
    if params.get('thread'):
        # one thread's comment tree - the Load live comments button in Signals
        tid = re.sub(r'[^A-Za-z0-9_]', '', str(params['thread']))[:20]
        n = int(params.get('commentsPer') or 120)
        log('cmd', 'rdt read %s -n %d' % (tid, n))
        post, comments = rr.thread(tid, n)
        base = {'id': tid, 'title': params.get('title') or '', 'subreddit': params.get('sub') or '', 'permalink': params.get('permalink') or '', 'selftext': ''}
        post = dict(base, **{k: v for k, v in (post or {}).items() if v not in (None, '')})
        rows = rr.comment_rows(post, comments)
        log('out', '%s: %d comments - %s' % (tid, len(rows), str(post.get('title') or '')[:70]))
        n_c, tot_c = rr.push(worker, key, 'reddit_comment', rows)
        return {'ok': True, 'platform': 'reddit', 'thread': tid, 'threads': 0, 'threadRows': 0, 'comments': len(rows),
                'commentRows': n_c, 'hostile': sum(1 for r in rows if r['tone'] < 0), 'errors': [], 'holds': {'comments': tot_c}}
    sel = [s for s in str(params.get('issue') or '').split(',') if s.strip()]
    q = params.get('queries', 'auto')
    queries = rr.queries_for(sel) if q == 'auto' else ([str(x) for x in q] if isinstance(q, list) else [])
    # listings:false is a keyword research run: the search terms only, no sub listings
    subs = [] if params.get('listings') is False else (params.get('subs') or rr.SUBS)
    topic = str(params.get('topic') or '')
    log('info', 'Reddit: %d subs, %d keywords%s' % (len(subs), len(queries), (' for topic ' + topic) if topic else ''))
    trows, crows, errors = rr.sweep(subs, int(params.get('perSub') or 25), int(params.get('threads') or 60),
                                    int(params.get('commentsPer') or 80), pace=float(params.get('pace') or 1.2),
                                    log=lambda *a: log('info', a[0] if len(a) == 1 else ' '.join(str(x) for x in a)),
                                    queries=queries, per_query=int(params.get('perQuery') or 25),
                                    when=str(params.get('time') or 'week'), cmdlog=log, topic=topic)
    n_t, tot_t = rr.push(worker, key, 'reddit_thread', trows)
    n_c, tot_c = rr.push(worker, key, 'reddit_comment', crows)
    return {'ok': True, 'platform': 'reddit', 'threads': len(trows), 'comments': len(crows),
            'threadRows': n_t, 'commentRows': n_c, 'hostile': sum(1 for r in crows if r['tone'] < 0),
            'errors': errors[:5], 'holds': {'threads': tot_t, 'comments': tot_c}}


def job_x(worker, key, params, log):
    sel = [s for s in str(params.get('issue') or '').split(',') if s.strip()]
    q = params.get('queries', 'auto')
    queries = rr.queries_for(sel) if q == 'auto' else ([str(x) for x in q] if isinstance(q, list) else [])
    # a topic run adds the MP and senator accounts: the keyword from their own mouths
    handles = [str(h) for h in (params.get('from') or []) if str(h).strip()]
    mps = {str(m.get('x') or '').lstrip('@').lower(): m for m in (params.get('mps') or []) if isinstance(m, dict) and m.get('x')}
    topic = str(params.get('topic') or '')
    log('info', 'X: %d keywords, %s window%s%s' % (len(queries), params.get('time') or 'week', (', %d MP accounts' % len(handles)) if handles else '', (' for topic ' + topic) if topic else ''))
    st = rx.status()
    log('out', 'twitter session: %s' % ('signed in' if (st or {}).get('authenticated', True) else 'not signed in'))
    # Signed in is not the same as able to search, and this path does not go
    # through reach-x's own preflight. Without this the sweep 404s on every
    # keyword and reports a successful job with nothing found, which is worse
    # than a failure because nobody goes looking.
    rx.assert_searchable()
    trows, crows, errors, found = rx.sweep(queries, int(params.get('perQuery') or 25), int(params.get('threads') or 20),
                                           int(params.get('commentsPer') or 40), str(params.get('time') or 'week'),
                                           pace=float(params.get('pace') or 1.5), log=log, handles=handles, mps=mps, topic=topic,
                                           from_terms=[str(x) for x in (params.get('fromQueries') or [])] or None)
    n_t, tot_t = rr.push(worker, key, 'sig_thread', trows)
    n_c, tot_c = rr.push(worker, key, 'sig_comment', crows)
    return {'ok': True, 'platform': 'x', 'found': found, 'threads': len(trows), 'comments': len(crows),
            'threadRows': n_t, 'commentRows': n_c, 'hostile': sum(1 for r in crows if r['tone'] < 0),
            'errors': errors[:5], 'holds': {'threads': tot_t, 'comments': tot_c}}


def job_render(worker, key, params, log):
    """A source's listing page (files what it finds, reports the probe) or one
    article (writes its text back onto the archive row), through Chromium."""
    if not have_playwright():
        raise RuntimeError('render needs Playwright on this machine: pip install playwright && playwright install chromium')
    base = worker.rstrip('/')
    url = str(params.get('url') or '')
    src = str(params.get('source') or '')
    t0 = time.time()
    if src:
        lst = rr.http_json(base + '/sources?q=' + urllib.parse.quote(src), key, timeout=30)
        s = next((x for x in (lst.get('sources') or []) if x.get('id') == src), None)
        if not s: raise RuntimeError('no source with id %s' % src)
        url = url or (s.get('urls') or {}).get('home') or ''
        if not url: raise RuntimeError('%s has no listing page to render' % src)
        log('cmd', 'chromium goto %s' % url)
        html_text, final = render_html(url)
        items = listing_links(html_text, final or url)
        ms = int((time.time() - t0) * 1000)
        log('out', '%d article-shaped links on the rendered page (%dms)' % (len(items), ms))
        now = int(time.time() * 1000)
        rows = [{'src': src, 'title': it['title'][:500], 'body': '', 'url': it['link'], 'ts': now,
                 'meta': {'reg': 1, 'source': src, 'tier': s.get('tier'), 'juris': s.get('juris'), 'method': 'render', 'issues': tag_issues(it['title']), 'dated': 0, 'via': 'reach'}}
                for it in items]
        n, tot = rr.push(worker, key, 'news', rows) if rows else (0, 0)
        log('info', 'filed %d new rows for %s' % (n, src))
        rr.http_json(base + '/sources/report', key, {'id': src, 'ok': bool(items), 'method': 'render', 'n': len(items), 'added': n, 'ms': ms,
                                                    'detail': '' if items else 'rendered page had no article-shaped links'}, timeout=30)
        return {'ok': bool(items), 'source': src, 'url': url, 'items': len(items), 'added': n, 'method': 'render', 'holds': {'news': tot}}
    if not re.match(r'^https?://', url):
        raise RuntimeError('render needs a url or a source id')
    log('cmd', 'chromium goto %s' % url)
    html_text, final = render_html(url)
    title, text = extract_article(html_text)
    log('out', '%d chars of body text (%dms)' % (len(text), int((time.time() - t0) * 1000)))
    filed = None
    if params.get('id') and len(text) >= FT_MIN:
        filed = rr.http_json(base + '/fulltext/save', key, {'id': params['id'], 'text': text[:6000], 'title': title, 'method': 'render', 'link': final}, timeout=30)
        log('info', 'archive row %s now carries the article' % params['id'])
    return {'ok': len(text) >= FT_MIN, 'url': url, 'final': final, 'title': title, 'chars': len(text), 'method': 'render',
            'filed': (filed or {}).get('id', 0), 'text': text[:2000]}


JOBS = {'reddit': job_reddit, 'x': job_x, 'render': job_render}


def run_job(worker, key, job, echo=True):
    src = job.get('source')
    log = Stream(worker, key, job.get('id'), echo=echo)
    log('info', 'agent picked up %s job %s' % (src, job.get('id')))
    try:
        fn = JOBS.get(src)
        if not fn:
            raise RuntimeError('this collector cannot run "%s" - it handles %s' % (src, ', '.join(sorted(JOBS))))
        result = fn(worker, key, job.get('params') or {}, log)
        ok = True
    except rx.XUnavailable as e:
        # Not a broken collector: the platform cannot be read from here. Its
        # own error code so the job log says which, and so a retry is not
        # the obvious response.
        result = {'ok': False, 'error': 'x_unavailable', 'detail': str(e)[:400]}
        log('err', str(e)[:400])
        ok = False
    except Exception as e:
        result = {'ok': False, 'error': 'collector_failed', 'detail': str(e)[:300]}
        log('err', str(e)[:300])
        ok = False
    log.flush()
    try:
        rr.http_json(worker.rstrip('/') + '/bridge/done', key, {'job': job.get('id'), 'ok': ok, 'result': result}, timeout=30)
    except Exception as e:
        print('could not report the job as finished: %s' % e, file=sys.stderr)
    return result


def poll_once(worker, key, agent, sources, echo=True):
    d = rr.http_json(worker.rstrip('/') + '/bridge/next?agent=%s&sources=%s' % (agent, ','.join(sources)), key, timeout=30)
    job = d.get('job')
    if not job:
        return None
    # take the worker's lexicon with the job so tags match the app exactly
    lex = d.get('lexicon') or {}
    if lex.get('issues'):
        try:
            rr.ISSUES = [(str(i['id']), __import__('re').compile(i['wide'], __import__('re').I)) for i in lex['issues'] if i.get('wide')]
            rr.ISSUE_Q = {str(i['id']): [str(q) for q in (i.get('q') or [])] for i in lex['issues']}
            rr.ISSUE_NS = {str(i['id']): str(i.get('ns') or '') for i in lex['issues']}
            if lex.get('subs'): rr.SUBS = [str(s) for s in lex['subs']]
        except Exception:
            pass
    return run_job(worker, key, job, echo=echo)


# ---- launchd ----------------------------------------------------------------
def plist_path():
    return os.path.expanduser('~/Library/LaunchAgents/%s.plist' % LABEL)


def install_launchd(repo):
    log = os.path.expanduser('~/Library/Logs/axiom-reach-agent.log')
    cmd = 'cd %s && python3 tools/reach-agent.py --quiet' % repo.replace("'", "'\\''")
    xml = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>%s</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>-lc</string><string>%s</string></array>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>%s</string>
  <key>StandardErrorPath</key><string>%s</string>
</dict></plist>
''' % (LABEL, cmd.replace('&', '&amp;').replace('<', '&lt;'), log, log)
    path = plist_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: f.write(xml)
    uid = os.getuid()
    subprocess.run(['launchctl', 'bootout', 'gui/%d/%s' % (uid, LABEL)], capture_output=True)
    r = subprocess.run(['launchctl', 'bootstrap', 'gui/%d' % uid, path], capture_output=True, text=True)
    if r.returncode != 0:
        r = subprocess.run(['launchctl', 'load', '-w', path], capture_output=True, text=True)
    print('Installed %s' % path)
    print('The agent now stays connected while you are logged in, and takes Sweep jobs as they come. Log: %s' % log)
    print('Check: launchctl list | grep axiom      Remove: python3 tools/reach-agent.py --uninstall-launchd')
    if r.returncode != 0: print('launchctl said:', (r.stderr or r.stdout).strip(), file=sys.stderr)


def uninstall_launchd():
    uid = os.getuid(); path = plist_path()
    subprocess.run(['launchctl', 'bootout', 'gui/%d/%s' % (uid, LABEL)], capture_output=True)
    subprocess.run(['launchctl', 'unload', path], capture_output=True)
    if os.path.exists(path): os.remove(path)
    print('Removed %s' % path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--worker', default=WORKER)
    ap.add_argument('--agent', default=os.uname().nodename.split('.')[0][:32] if hasattr(os, 'uname') else 'desktop')
    ap.add_argument('--sources', default='', help='what this machine offers to collect (default: whatever is installed)')
    ap.add_argument('--poll', type=float, default=15.0, help='seconds between checks for new jobs')
    ap.add_argument('--once', action='store_true', help='take at most one job, then exit')
    ap.add_argument('--quiet', action='store_true')
    ap.add_argument('--install-launchd', action='store_true')
    ap.add_argument('--uninstall-launchd', action='store_true')
    a = ap.parse_args(argv)
    repo = os.path.dirname(HERE)
    if a.install_launchd: install_launchd(repo); return 0
    if a.uninstall_launchd: uninstall_launchd(); return 0
    if not a.key: sys.exit('need --key or AXIOM_KEY (export it in ~/.zshrc so the background agent can find it)')
    say = (lambda *x: None) if a.quiet else print
    sources = [s.strip() for s in a.sources.split(',') if s.strip()] or collectors()
    if not sources:
        sys.exit('no collectors installed on this machine. Reddit needs `rdt` (pipx install "git+https://github.com/public-clis/rdt-cli.git"); X needs `twitter` (uv tool install twitter-cli). Install one, sign in, and run this again.')
    say('%s  agent "%s" connected to %s, offering: %s' % (
        datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), a.agent, a.worker, ', '.join(sources)))
    if 'reddit' not in sources: say('  (rdt not installed: Reddit jobs will wait for another machine)')
    if 'x' not in sources: say('  (twitter not installed: X jobs will wait for another machine)')
    if 'render' not in sources: say('  (Playwright not installed: render jobs will wait for another machine - pip install playwright && playwright install chromium)')
    while True:
        try:
            r = poll_once(a.worker, a.key, a.agent, sources, echo=not a.quiet)
            if r is not None and a.once: return 0
            if r is None:
                if a.once: say('no job waiting'); return 0
                time.sleep(a.poll)
            # a job just ran: check again straight away in case more are queued
        except urllib.error.HTTPError as e:
            body = ''
            try: body = e.read().decode()[:200]
            except Exception: pass
            if e.code in (401, 403):
                sys.exit('AXIOM refused the key (HTTP %s). Use a full-access key: %s' % (e.code, body))
            say('worker said HTTP %s; retrying in %ds' % (e.code, int(a.poll)))
            time.sleep(a.poll)
        except KeyboardInterrupt:
            say('\nagent stopped'); return 0
        except Exception as e:
            say('connection trouble (%s); retrying in %ds' % (str(e)[:120], int(a.poll)))
            time.sleep(a.poll)


if __name__ == '__main__':
    sys.exit(main())
