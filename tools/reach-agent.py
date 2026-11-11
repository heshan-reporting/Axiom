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
  python3 tools/reach-agent.py --channels                  # what this machine can collect right now, and why not
  python3 tools/reach-agent.py --login facebook            # a person signs in to a platform for collection (also instagram, youtube)
  python3 tools/reach-agent.py --login news:afr            # a person signs in to a publisher the agency subscribes to

Facebook, Instagram and YouTube keyword search are read through agent-reach
(tools/reach_social.py) when it is installed and a person has signed in. Read
what --login prints before you do: collection with a signed-in account is
against those platforms' terms, and a profile that administers client assets
must never be used. The agent offers a platform only while it is usable, stops
at once on a verification and pauses that platform for 24 hours.

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
rs = _load('reach_social', 'reach_social.py')   # Facebook, Instagram and YouTube through agent-reach (layer 2)
WORKER = rr.WORKER


class Stream:
    """Log lines back to the job, in small batches. Every command the collector
    runs and every answer it gets shows up in the app while it happens."""

    def __init__(self, worker, key, job, echo=True, flush_every=6, flush_after=2.0):
        self.worker, self.key, self.job, self.echo = worker, key, job, echo
        self.buf, self.last = [], time.time()
        self.flush_every, self.flush_after = flush_every, flush_after

    def __call__(self, kind, text):
        text = rs.scrub(str(text))          # nothing shaped like a cookie, a token or a password is printed or sent
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


# ---- X search that does not work: stop offering it, say so once, look again every ten minutes ----------------------
# Signed in is not able to search (see reach-x.py). The first live run claimed sixteen X jobs in a row and failed each
# the same way, because `x` stayed in what the agent offered. Now one failure (or the check at the start) takes X out
# of the offer; the worker is told (`down=x` on every poll) so it stops queueing and says why; and the same
# ten-minute rhythm the social channels use asks twitter-cli again and puts X back when search works.
X_RECHECK = 600
X_DOWN = {}          # {'at': when last checked, 'why': the message} while X search is known not to work here


def x_mark_down(why, clock=time.time):
    X_DOWN['at'] = clock(); X_DOWN['why'] = str(why)


def x_check(clock=time.time):
    """Ask twitter-cli whether search can work (one `twitter status`, never a search). True when it can."""
    if not have('twitter'):
        X_DOWN.clear(); return False
    if rx.transaction_generator_broken():
        x_mark_down(rx.x_unavailable(), clock); return False
    X_DOWN.clear(); return True


def x_usable(clock=time.time):
    """Whether to offer X now. While it is down, twitter-cli is asked again only every ten minutes."""
    if not have('twitter'): return False
    if not X_DOWN: return True
    if clock() - X_DOWN.get('at', 0) < X_RECHECK: return False
    return x_check(clock)


def down():
    """What this machine has the tool for and still cannot read; sent to the worker with every poll."""
    return ['x'] if X_DOWN and have('twitter') else []


def offering(fixed=None, clock=time.time):
    """What to offer the worker: the --sources list when one was given, else what is installed - never X while its
    search is down, whoever asked for it."""
    if fixed: return [s for s in fixed if s != 'x' or x_usable(clock)]
    return collectors(clock)


def collectors(clock=time.time):
    """Which sources this machine can actually collect, checked not assumed."""
    out = []
    if have('rdt'): out.append('reddit')
    if x_usable(clock): out.append('x')
    if have_playwright(): out.append('render')
    if have_playwright() and gated_profiles(): out.append('gated')      # subscriber news: only with a publisher a person signed in to
    # Facebook, Instagram and YouTube search: only when agent-reach is installed, the channel is signed in to and
    # usable, it is not paused after a verification, and it is not switched off on this machine
    try:
        out += [s for s in rs.offered() if s not in out]
    except Exception:
        pass
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


# ---- subscriber news: a publisher the agency subscribes to, read with the profile a person signed in to -------------
PROFILES = os.path.join(os.path.expanduser(os.environ.get('AXIOM_REACH_HOME', '~/.axiom-reach')), 'profiles')


def gated_profiles():
    """The publishers a person has signed in to on this machine (one browser profile each)."""
    try:
        return sorted(d[5:] for d in os.listdir(PROFILES) if d.startswith('news-') and os.path.isdir(os.path.join(PROFILES, d)))
    except Exception:
        return []


def profile_dir(source_id):
    sid = re.sub(r'[^a-z0-9_]', '', str(source_id or '').lower())[:40]
    if not sid: raise RuntimeError('a publisher profile needs the source id from the Sources view')
    return os.path.join(PROFILES, 'news-' + sid)


def render_profile(url, source_id, wait_ms=2500, headless=True, wait_closed=False):
    """Load a page in Chromium with the publisher's own signed-in profile. The profile folder holds that session's
    cookies and stays on this machine; nothing reads or copies them."""
    from playwright.sync_api import sync_playwright
    d = profile_dir(source_id); os.makedirs(d, mode=0o700, exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(d, headless=headless, user_agent=UA, viewport={'width': 1280, 'height': 2200})
        try:
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.goto(url, wait_until='domcontentloaded', timeout=45000)
            if wait_closed:
                page.wait_for_event('close', timeout=0); return '', url
            try: page.wait_for_load_state('networkidle', timeout=15000)
            except Exception: pass
            page.wait_for_timeout(wait_ms)
            return page.content(), page.url
        finally:
            try: ctx.close()
            except Exception: pass


def job_gated(worker, key, params, log, render=None):
    """One article of a cleared subscriber source, read as the signed-in subscriber sees it, and handed to the worker,
    which keeps it apart from everything it serves. A page that still shows the paywall is reported as that."""
    src = re.sub(r'[^a-z0-9_]', '', str(params.get('profile') or '').lower()); url = str(params.get('url') or '')
    if not re.match(r'^https?://', url): raise RuntimeError('the subscriber read needs the article address')
    if src not in gated_profiles():
        raise RuntimeError('no signed-in profile for "%s" on this machine. A person signs in once: python3 tools/reach-agent.py --login news:%s' % (src, src))
    log('cmd', 'chromium (profile news-%s) goto %s' % (src, url))
    html_text, final = (render or render_profile)(url, src)
    _title, text = extract_article(html_text)
    text = str(text or '')
    base = worker.rstrip('/'); body = {'id': params.get('id'), 'url': url, 'source': src, 'gated': True, 'via': 'reach'}
    if len(text) < FT_MIN:
        log('err', '%s still showed its paywall to the signed-in browser (%d characters of article)' % (src, len(text)))
        r = _post_soft(base + '/fulltext/save', key, dict(body, wall=True))
        return {'ok': False, 'error': 'subscription_wall', 'source': src, 'url': url, 'chars': len(text), 'detail': (r or {}).get('detail') or 'the page still showed its paywall'}
    log('out', '%d characters of article' % len(text))
    r = _post_soft(base + '/fulltext/save', key, dict(body, text=text))
    if not (r or {}).get('ok'):
        return {'ok': False, 'error': (r or {}).get('error') or 'save_refused', 'source': src, 'url': url, 'detail': (r or {}).get('detail') or 'the worker did not file the text'}
    return {'ok': True, 'source': src, 'url': url, 'chars': len(text), 'method': 'subscriber', 'filed': r.get('id', 0)}


def _post_soft(url, key, body):
    """POST and return the JSON answer even when the worker refuses (a refusal carries the reason)."""
    try:
        return rr.http_json(url, key, body, timeout=30)
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode() or '{}')
        except Exception: return {'ok': False, 'error': 'http_%s' % e.code}


NEWS_WARNING = '''
  Before you sign in to a publisher for collection, read this.

  - Use only a subscription the agency holds. Never a personal, borrowed or shared login.
  - The worker reads nothing from this publisher until someone has recorded, on the source in the
    Sources view, what covers reading it for monitoring (the subscription or the copyright licence).
  - Only articles already tagged to a client issue are read, inside a daily cap. The collector does
    not download the paper, and it uses no paywall-bypass service or trick.
  - The text is for the team's own reading. AXIOM serves it to nobody outside the team.
  - You sign in yourself, in the window that opens, then close the window. This tool never sees the password.
'''


def login_news(source_id, url, ask=input, out=print, render=None):
    out(NEWS_WARNING)
    if ask('  Is this a subscription the agency holds? (yes/no): ').strip().lower() != 'yes':
        out('  Stopped: nothing was opened.'); return False
    if not have_playwright() and render is None:
        out('  This needs Playwright: pip install playwright && playwright install chromium'); return False
    out('  A browser window is opening at %s. Sign in, then close the window.' % url)
    (render or render_profile)(url, source_id, headless=False, wait_closed=True)
    out('  Signed-in profile kept for "%s" on this Mac. Remove it at any time by deleting %s' % (source_id, profile_dir(source_id)))
    return True


def job_social(channel):
    def run(worker, key, params, log):
        return rs.collect(channel, worker, key, params, log)
    return run


JOBS = {'reddit': job_reddit, 'x': job_x, 'render': job_render,
        'facebook': job_social('facebook'), 'instagram': job_social('instagram'), 'ytsearch': job_social('youtube'), 'gated': job_gated}


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
        # The message leads with what to do (reach-x.py X_REMEDY), and is sent whole: 400 characters used to cut
        # it before the remedy. A console line holds 1,200.
        x_mark_down(str(e))
        result = {'ok': False, 'error': 'x_unavailable', 'detail': rs.scrub(str(e))[:1100]}
        log('err', str(e)[:1200])
        ok = False
    except rs.Challenge as e:
        # The platform asked for a verification. The collector has already stopped and paused that platform here for
        # 24 hours; the worker tells the team once. A person clears it by hand. Nothing retries.
        result = {'ok': False, 'error': rs.CHANNELS[e.channel]['platform'] + '_challenge', 'detail': rs.scrub(str(e))[:400]}
        log('err', result['detail'])
        ok = False
    except rs.Unavailable as e:
        result = {'ok': False, 'error': rs.CHANNELS[e.channel]['platform'] + '_unavailable', 'why': e.why, 'detail': rs.scrub(str(e))[:400]}
        log('err', result['detail'])
        ok = False
    except rs.ParseFailed as e:
        result = {'ok': False, 'error': rs.CHANNELS[e.channel]['platform'] + '_parse_failed', 'detail': rs.scrub(str(e))[:400]}
        log('err', result['detail'])
        ok = False
    except Exception as e:
        result = {'ok': False, 'error': 'collector_failed', 'detail': rs.scrub(str(e))[:300]}
        log('err', str(e)[:300])
        ok = False
    log.flush()
    try:
        rr.http_json(worker.rstrip('/') + '/bridge/done', key, {'job': job.get('id'), 'ok': ok, 'result': result}, timeout=30)
    except Exception as e:
        print('could not report the job as finished: %s' % e, file=sys.stderr)
    return result


def poll_once(worker, key, agent, sources, echo=True):
    d = rr.http_json(worker.rstrip('/') + '/bridge/next?agent=%s&sources=%s%s' % (agent, ','.join(sources), ('&down=' + ','.join(down())) if down() else ''), key, timeout=30)
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


def launchd_command(repo, python=None):
    q = lambda x: "'" + str(x).replace("'", "'\\''") + "'"
    return 'cd %s && %s tools/reach-agent.py --quiet' % (q(repo), q(python or sys.executable or 'python3'))


def install_launchd(repo):
    log = os.path.expanduser('~/Library/Logs/axiom-reach-agent.log')
    # the Python that installs it is the Python that runs it: installed from the collector's own environment
    # (~/.axiom-reach/venv/bin/python), the background agent sees Playwright and yt-dlp there; plain `python3` did not
    cmd = launchd_command(repo)
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
    ap.add_argument('--login', metavar='PLATFORM', help='sign in to facebook, instagram or youtube for collection (a person does this, by hand)')
    ap.add_argument('--url', default='', help='with --login news:<source id>: the page to open')
    ap.add_argument('--channels', action='store_true', help='what this machine can collect right now, and why not where it cannot')
    ap.add_argument('--uninstall-launchd', action='store_true')
    a = ap.parse_args(argv)
    repo = os.path.dirname(HERE)
    if a.install_launchd: install_launchd(repo); return 0
    if a.uninstall_launchd: uninstall_launchd(); return 0
    if a.login and a.login.strip().lower().startswith('news:'):
        sid = re.sub(r'[^a-z0-9_]', '', a.login.strip().lower()[5:])
        url = a.url
        if not url:
            if not a.key: sys.exit('give --url (the publisher\'s sign-in or home page), or --key so the address can be read from the Sources view')
            lst = rr.http_json(a.worker.rstrip('/') + '/sources?q=' + urllib.parse.quote(sid), a.key, timeout=30)
            s = next((x for x in (lst.get('sources') or []) if x.get('id') == sid), None)
            if not s: sys.exit('no source with id "%s" in the Sources view' % sid)
            url = (s.get('urls') or {}).get('home') or ('https://' + (s.get('urls') or {}).get('site', ''))
        return 0 if login_news(sid, url) else 1
    if a.login:
        return 0 if rs.login(a.login.strip().lower()) else 1
    if a.channels:
        print('reddit     %s' % ('usable' if have('rdt') else 'rdt is not installed'))
        print('x          %s' % ('twitter is not installed' if not have('twitter') else 'usable' if x_check() else 'search is unavailable  - ' + rx.x_remedy()))
        print('render     %s' % ('usable' if have_playwright() else 'Playwright is not installed'))
        print('gated      %s' % (('usable for: ' + ', '.join(gated_profiles())) if (have_playwright() and gated_profiles()) else 'no publisher is signed in on this machine (--login news:<source id>)'))
        for c in rs.CHANNELS:
            st = rs.status(c)
            print('%-10s %s%s' % (c, 'usable, %d of %d reads today' % (st['reads_today'], st['per_day']) if st['usable'] else (st['status'] or 'not installed'), ('  - ' + st['why']) if st.get('why') else '') + (('\n             ' + st['native_hint']) if st.get('native_hint') else '') + ((' (read through %s)' % st['backend']) if st.get('backend') and st['usable'] else ''))
        return 0
    if not a.key: sys.exit('need --key or AXIOM_KEY (export it in ~/.zshrc so the background agent can find it)')
    say = (lambda *x: None) if a.quiet else print
    fixed = [s.strip() for s in a.sources.split(',') if s.strip()]
    try:
        return serve(a.worker, a.key, a.agent, fixed, poll=a.poll, once=a.once, say=say, echo=not a.quiet)
    except KeyboardInterrupt:
        say('\nagent stopped'); return 0


X_STOPPED = 'no longer offering X: '
X_BACK = 'X search works again: offering X again'


def serve(worker, key, agent, fixed, poll=15.0, once=False, say=print, echo=True, sleep=time.sleep, clock=time.time, rounds=None):
    """Stay connected: offer what this machine can read, take a job when there is one, look again at what can be read
    every ten minutes. `rounds`, `sleep` and `clock` exist so the loop can be driven by a test."""
    if have('twitter') and (not fixed or 'x' in fixed) and not x_check(clock):
        say('  twitter-cli is installed but X search cannot work on this machine: not offering X. ' + rx.x_remedy())
    sources = offering(fixed, clock); checked = clock()
    if not sources and not down():
        sys.exit('no collectors installed on this machine. Reddit needs `rdt` (pipx install "git+https://github.com/public-clis/rdt-cli.git"); X needs `twitter` (uv tool install twitter-cli). Install one, sign in, and run this again.')
    say('%s  agent "%s" connected to %s, offering: %s' % (
        datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), agent, worker, ', '.join(sources) or 'nothing yet'))
    if not have('rdt'): say('  (rdt not installed: Reddit jobs will wait for another machine)')
    if not have('twitter'): say('  (twitter not installed: X jobs will wait for another machine)')
    if 'render' not in sources: say('  (Playwright not installed: render jobs will wait for another machine - python3 -m pip install playwright && python3 -m playwright install chromium)')
    if not any(s in sources for s in ('facebook', 'instagram', 'ytsearch')): say('  (no social channel is usable here - Facebook, Instagram or YouTube search: python3 tools/reach-agent.py --channels says why)')
    n = 0
    while rounds is None or n < rounds:
        n += 1
        try:
            if clock() - checked >= X_RECHECK:
                # a platform signed in to, paused, switched off or repaired since the agent started is offered, or not, from now on
                was_down = bool(X_DOWN)
                now_have = offering(fixed, clock); checked = clock()
                if was_down and 'x' in now_have: say('  ' + X_BACK)
                if sorted(now_have) != sorted(sources): say('  now offering: %s' % (', '.join(now_have) or 'nothing')); sources = now_have
            r = poll_once(worker, key, agent, sources, echo=echo) if (sources or down()) else None
            if X_DOWN and 'x' in sources:
                # the job just run learned that X search cannot work here: one failure, not one per queued job
                sources = [s for s in sources if s != 'x']; X_DOWN['at'] = clock()
                say('  ' + X_STOPPED + rx.x_remedy())
            if r is not None and once: return 0
            if r is None:
                if once: say('no job waiting'); return 0
                sleep(poll)
            # a job just ran: check again straight away in case more are queued
        except urllib.error.HTTPError as e:
            body = ''
            try: body = e.read().decode()[:200]
            except Exception: pass
            if e.code in (401, 403):
                sys.exit('AXIOM refused the key (HTTP %s). Use a full-access key: %s' % (e.code, body))
            say('worker said HTTP %s; retrying in %ds' % (e.code, int(poll)))
            sleep(poll)
        except KeyboardInterrupt:
            raise
        except Exception as e:
            say('connection trouble (%s); retrying in %ds' % (str(e)[:120], int(poll)))
            sleep(poll)
    return 0


if __name__ == '__main__':
    sys.exit(main())
