#!/usr/bin/env python3
"""
reach-reddit.py - sweep the Australian political subreddits from a machine that
can actually reach Reddit and file the threads and comments in AXIOM's archive.

Why this exists. Reddit refuses anonymous reads from cloud networks (Cloudflare
included) and closed self-service API registration in late 2025, so the worker's
own sweep usually collects nothing. Your Mac, with agent-reach's rdt-cli logged
in (`rdt login`, or a cookie file - see agent-reach doctor), can read everything.
This script runs there and produces exactly the rows the worker would have
written: kind `reddit_thread` (url = permalink) and kind `reddit_comment`
(url = x:rcmt:<id>), issue-tagged and tone-read. The Reddit view, Analyse and
Send to the Mind all work on them unchanged. Usernames are never stored.

Usage (on the Mac, from the repo):
  python3 tools/reach-reddit.py --key $AXIOM_KEY               # sweep and file now
  python3 tools/reach-reddit.py --out reddit-rows.json --dry-run # write a rows file for the in-app Load data button
  python3 tools/reach-reddit.py --install-launchd               # run every 3 hours in the background
  python3 tools/reach-reddit.py --uninstall-launchd

Options: --subs A,B,C  --per-sub 25  --threads 20  --comments 40  --worker URL
Stdlib only. Needs `rdt` on PATH (pipx install 'git+https://github.com/public-clis/rdt-cli.git').
"""
import argparse, datetime, json, os, re, subprocess, sys, time, urllib.request

WORKER = 'https://newsaus.heshan-998.workers.dev'
SUBS = ['AustralianPolitics', 'australia', 'AusPol', 'AusFinance', 'AusEcon']
LABEL = 'com.curiousminds.axiom.reach-reddit'

# The client issues, mirrored from CLIENT_ISSUES in the worker so tags match.
ISSUES = [
    ('ftc', re.compile(r'fuel tax credit|diesel rebate|diesel fuel rebate|fuel excise credit|hands off our fuel|\bhoof\b', re.I)),
    ('cm', re.compile(r'critical minerals?|rare earths?|gallium|antimony|strategic reserve', re.I)),
    ('mining', re.compile(r'mining (tax|royalt|approval|jobs)|resources (sector|industry|policy)|royalties', re.I)),
    ('gas', re.compile(r'gas (supply|reservation|shortfall|market|price)|domestic gas|\blng\b', re.I)),
    ('energy', re.compile(r'energy (policy|prices|bills|transition|security)|electricity price|power bill', re.I)),
    ('vicelection', re.compile(r'victorian? (state )?election|victorian (government|premier|parliament)|spring street', re.I)),
    ('regional', re.compile(r'regional victoria|country victoria|regional (rail|road|health|hospital|service)', re.I)),
    ('housing', re.compile(r'housing (policy|supply|crisis|target|approval)|planning reform|build-to-rent|negative gearing', re.I)),
    ('construction', re.compile(r'construction (industry|sector|union|cost)|\bcfmeu\b|building (industry|code|approvals)', re.I)),
    ('col', re.compile(r'cost of living|inflation|interest rates?|rba (decision|hold|cut|rise|board)', re.I)),
    ('gov', re.compile(r'newspoll|primary vote|preferred prime minister|approval rating|by-?election|leadership spill', re.I)),
]
# Comment tone, mirrored from CMT_POS / CMT_NEG in the worker.
CMT_POS = re.compile(r"\b(agree|well said|spot on|100 ?%|thank you|thanks|love (this|it)|great|good on (you|them|ya)|exactly|so true|support(ed|ing)?|keep (it )?up|finally|about time|legend|onya|well done|fair enough|makes sense)\b|\+1|<3", re.I)
CMT_NEG = re.compile(r"\b(lies?|lying|liar|rubbish|garbage|\bbs\b|bullshit|scam|greedy?|greed|disgrace(ful)?|disgusting|joke|pathetic|propaganda|shame(ful)?|corrupt(ion)?|hypocri\w*|nonsense|rort|polluters?|wrong|nobody believes|sick of|fed up|rip ?off|dodgy|spin|misleading|shill|paid for|who funds|dishonest|disinformation|misinformation|lobby(ists?)?|at our expense|pay(ing)? (more|their|five|ten|double)|should be paying|billionaires?|pretend(ing)?|con job|another discount|tax the|rip(ping)? (us|off)|handouts?|subsid(y|ies|ised))\b", re.I)


def tone(text):
    s = str(text or '')
    if CMT_NEG.search(s): return -1
    if CMT_POS.search(s): return 1
    return 0


def issues_of(text):
    s = str(text or '')
    return [i for i, rx in ISSUES if rx.search(s)]


# ---- rdt (agent-reach's Reddit backend) -------------------------------------
def run_rdt(args, timeout=90):
    """Run `rdt ... --json` and return its data payload. Raises RuntimeError with rdt's own message on failure."""
    try:
        p = subprocess.run(['rdt'] + list(args) + ['--json'], capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        raise RuntimeError("rdt is not installed. Install agent-reach's Reddit backend: pipx install 'git+https://github.com/public-clis/rdt-cli.git' then `rdt login`.")
    except subprocess.TimeoutExpired:
        raise RuntimeError('rdt timed out after %ds on: %s' % (timeout, ' '.join(args)))
    out = (p.stdout or '').strip()
    try:
        d = json.loads(out[out.index('{'):]) if '{' in out else {}
    except Exception:
        d = {}
    if not d:
        raise RuntimeError('rdt returned no JSON for: %s%s' % (' '.join(args), (' - ' + (p.stderr or '').strip()[-200:]) if p.stderr else ''))
    if not d.get('ok', False):
        err = d.get('error') or {}
        msg = err.get('message') or str(err) or 'unknown error'
        code = err.get('code') or ''
        if 'login' in (msg + code).lower() or 'auth' in (msg + code).lower() or '401' in msg or '403' in msg:
            msg += ". Reddit needs a logged-in session: run `rdt login` on this Mac (Chrome must be signed in to reddit.com), or write ~/.config/rdt-cli/credential.json with your reddit_session cookie - see `agent-reach doctor`."
        raise RuntimeError('rdt %s: %s' % (code, msg))
    return d.get('data', d)


def rdt_status():
    d = run_rdt(['status'])
    return d


def posts_from(payload):
    """Posts out of any shape rdt emits for a listing: a plain list of posts
    (--compact), rdt's ListingPage {items:[...]}, or Reddit's raw
    {kind:'Listing', data:{children:[{kind:'t3', data:{...}}]}}."""
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        if isinstance(payload.get('items'), list):
            items = payload['items']
        else:
            inner = payload.get('data') if isinstance(payload.get('data'), dict) else payload
            items = inner.get('children') if isinstance(inner, dict) else None
            if items is None and isinstance(payload.get('data'), dict) and isinstance(payload['data'].get('data'), dict):
                items = payload['data']['data'].get('children')
    else:
        items = []
    out = []
    for it in items or []:
        if not isinstance(it, dict): continue
        p = it.get('data') if isinstance(it.get('data'), dict) and 'title' not in it else it
        if isinstance(p, dict) and (p.get('id') or p.get('title')):
            out.append(p)
    return out


def listing(sub, sort, n):
    # --compact makes rdt emit the parsed post list rather than Reddit's raw listing
    args = ['sub', sub, '-s', sort, '-n', str(n), '-c']
    if sort == 'top': args += ['-t', 'day']
    return [p for p in posts_from(run_rdt(args)) if not p.get('stickied')]


def detail_from(payload):
    """(post, comments) out of rdt's PostDetail {post, comments} or Reddit's raw
    [post_listing, comment_listing]; raw comment nodes are unwrapped to the
    same {id, author, body, score, created_utc, replies:[...]} shape."""
    def node(n):
        if not isinstance(n, dict): return None
        if n.get('kind') == 'more': return {'author': '[more]', 'body': '', 'replies': []}
        d = n.get('data') if isinstance(n.get('data'), dict) and 'body' not in n else n
        if not isinstance(d, dict): return None
        reps = d.get('replies')
        if isinstance(reps, dict):
            reps = [node(c) for c in (reps.get('data') or {}).get('children', [])]
        elif isinstance(reps, list):
            reps = [node(c) for c in reps]
        else:
            reps = []
        return {'id': d.get('id'), 'author': d.get('author'), 'body': d.get('body'), 'score': d.get('score'), 'created_utc': d.get('created_utc'), 'replies': [r for r in reps if r]}
    if isinstance(payload, list):
        post = {}
        if payload and isinstance(payload[0], dict):
            ch = (payload[0].get('data') or {}).get('children') or []
            if ch and isinstance(ch[0], dict): post = ch[0].get('data') or ch[0]
        raw = (payload[1].get('data') or {}).get('children') if len(payload) > 1 and isinstance(payload[1], dict) else []
        return post, [c for c in (node(x) for x in raw or []) if c]
    if isinstance(payload, dict):
        return payload.get('post') or {}, [c for c in (node(x) for x in payload.get('comments') or []) if c]
    return {}, []


def thread(post_id, n):
    return detail_from(run_rdt(['read', post_id, '-n', str(n)]))


def flatten(comments, depth=0, max_depth=3, out=None):
    out = [] if out is None else out
    for c in comments or []:
        if not isinstance(c, dict): continue
        body = str(c.get('body') or '')
        if c.get('author') == '[more]' or not body.strip() or body in ('[deleted]', '[removed]'):
            continue
        out.append({'id': str(c.get('id') or ''), 'body': body[:3000], 'score': int(c.get('score') or 0), 'depth': depth, 'created': float(c.get('created_utc') or 0) * 1000})
        if depth < max_depth:
            flatten(c.get('replies') or [], depth + 1, max_depth, out)
    return out


# ---- rows, in the worker's exact shape ---------------------------------------
def permalink_of(p):
    pl = str(p.get('permalink') or '')
    return pl if pl.startswith('http') else 'https://www.reddit.com' + pl


def domain_of(url):
    m = re.match(r'https?://([^/]+)', str(url or ''))
    return (m.group(1).lower().replace('www.', '') if m else '')


def thread_row(p):
    title = str(p.get('title') or '')[:400]
    body = str(p.get('selftext') or '')[:4000]
    sub = str(p.get('subreddit') or '')
    link = str(p.get('url') or '')
    domain = domain_of(link)
    isu = issues_of(title + ' ' + body)
    score = int(p.get('score') or 0); ncom = int(p.get('num_comments') or 0)
    created = float(p.get('created_utc') or 0) * 1000
    return {
        'src': 'reddit', 'title': title,
        'body': body[:3000] + '\n%d points, %d comments' % (score, ncom) + ('\nLink: ' + link if link and 'reddit.com' not in domain else ''),
        'url': permalink_of(p), 'author': '', 'tone': tone(title + ' ' + body), 'ts': int(created or time.time() * 1000),
        'meta': {'sub': sub, 'id': str(p.get('id') or ''), 'score': score, 'ratio': 0, 'comments': ncom, 'flair': '', 'domain': domain,
                 'link': link[:300], 'issues': isu, 'issue': isu[0] if isu else '', 'via': 'reach'},
    }


def comment_rows(post, comments):
    title = str(post.get('title') or '')
    t_issues = issues_of(title + ' ' + str(post.get('selftext') or ''))
    tid = str(post.get('id') or ''); sub = str(post.get('subreddit') or ''); pl = permalink_of(post)
    rows = []
    for c in flatten(comments):
        own = issues_of(c['body']); allis = own if own else t_issues
        rows.append({
            'src': 'reddit', 'title': 'Comment on: ' + title[:120], 'body': c['body'], 'url': 'x:rcmt:' + c['id'], 'author': '',
            'tone': tone(c['body']), 'ts': int(c['created'] or time.time() * 1000),
            'meta': {'sub': sub, 'thread': tid, 'thread_title': title[:200], 'permalink': pl, 'score': c['score'], 'depth': c['depth'],
                     'issues': allis, 'issue': allis[0] if allis else '', 'tone': tone(c['body']), 'via': 'reach'},
        })
    return rows


# ---- AXIOM ------------------------------------------------------------------------
def http_json(url, key=None, body=None, timeout=60):
    req = urllib.request.Request(url, method='POST' if body is not None else 'GET',
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', 'User-Agent': 'axiom-reach-reddit/1.0', **({'X-Axiom-Key': key} if key else {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or '{}')


def kind_count(worker, kind):
    try:
        return int((http_json(worker.rstrip('/') + '/archive/stats').get('byKind') or {}).get(kind, 0))
    except Exception:
        return None


def push(worker, key, kind, rows):
    added = 0; total = None
    for i in range(0, len(rows), 150):
        batch = rows[i:i + 150]
        for attempt in range(4):
            try:
                d = http_json(worker.rstrip('/') + '/archive/add', key, {'kind': kind, 'rows': batch})
                if d.get('error'):
                    raise SystemExit('AXIOM refused: %s %s' % (d.get('error'), d.get('detail', '')))
                added += int(d.get('added', 0));
                if 'total' in d: total = int(d['total'])
                break
            except urllib.error.HTTPError as e:
                raise SystemExit('HTTP %s from %s - %s' % (e.code, worker, e.read().decode()[:200]))
            except SystemExit:
                raise
            except Exception as e:
                if attempt == 3: print('  batch failed:', e, file=sys.stderr)
                else: time.sleep(2 ** attempt)
    return added, total


# ---- the sweep ---------------------------------------------------------------------
def sweep(subs, per_sub, n_threads, n_comments, pace=1.2, log=print):
    seen = {}; errors = []
    for sub in subs:
        for sort in ('hot', 'top'):
            try:
                for p in listing(sub, sort, per_sub):
                    pid = str(p.get('id') or '')
                    if pid and pid not in seen: seen[pid] = p
            except RuntimeError as e:
                errors.append('r/%s/%s: %s' % (sub, sort, e))
                if 'login' in str(e).lower(): raise
            time.sleep(pace)
    threads = list(seen.values())
    weight = lambda p: len(issues_of(str(p.get('title') or '') + ' ' + str(p.get('selftext') or ''))) * 1000 + int(p.get('num_comments') or 0)
    pick = sorted(threads, key=weight, reverse=True)[:n_threads]
    trows = [thread_row(p) for p in threads]
    crows = []
    for p in pick:
        try:
            post, comments = thread(str(p.get('id')), n_comments)
            crows.extend(comment_rows(post or p, comments))
        except RuntimeError as e:
            errors.append('%s: %s' % (p.get('id'), e))
        time.sleep(pace)
    return trows, crows, errors


# ---- launchd ------------------------------------------------------------------------
def plist_path():
    return os.path.expanduser('~/Library/LaunchAgents/%s.plist' % LABEL)


def install_launchd(repo, interval=10800):
    log = os.path.expanduser('~/Library/Logs/axiom-reach-reddit.log')
    # zsh -lc sources ~/.zshrc, so $AXIOM_KEY resolves without the key ever touching this file
    cmd = 'cd %s && python3 tools/reach-reddit.py --quiet' % repo.replace("'", "'\\''")
    xml = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>%s</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>-lc</string><string>%s</string></array>
  <key>StartInterval</key><integer>%d</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>%s</string>
  <key>StandardErrorPath</key><string>%s</string>
</dict></plist>
''' % (LABEL, cmd.replace('&', '&amp;').replace('<', '&lt;'), interval, log, log)
    path = plist_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: f.write(xml)
    uid = os.getuid()
    subprocess.run(['launchctl', 'bootout', 'gui/%d/%s' % (uid, LABEL)], capture_output=True)
    r = subprocess.run(['launchctl', 'bootstrap', 'gui/%d' % uid, path], capture_output=True, text=True)
    if r.returncode != 0:
        r = subprocess.run(['launchctl', 'load', '-w', path], capture_output=True, text=True)
    print('Installed %s' % path)
    print('Runs now and every %d hours while you are logged in. Log: %s' % (interval // 3600, log))
    print('Check: launchctl list | grep axiom      Remove: python3 tools/reach-reddit.py --uninstall-launchd')
    if r.returncode != 0: print('launchctl said:', (r.stderr or r.stdout).strip(), file=sys.stderr)


def uninstall_launchd():
    uid = os.getuid(); path = plist_path()
    subprocess.run(['launchctl', 'bootout', 'gui/%d/%s' % (uid, LABEL)], capture_output=True)
    subprocess.run(['launchctl', 'unload', path], capture_output=True)
    if os.path.exists(path): os.remove(path)
    print('Removed %s' % path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--subs', default=','.join(SUBS), help='comma-separated subreddits')
    ap.add_argument('--per-sub', type=int, default=25)
    ap.add_argument('--threads', type=int, default=20, help='threads whose comments to fetch')
    ap.add_argument('--comments', type=int, default=40, help='comments per thread')
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--worker', default=WORKER)
    ap.add_argument('--out', help='also write the rows to this JSON file ({batches:[...]}, loadable in-app)')
    ap.add_argument('--dry-run', action='store_true', help='collect and report, do not push')
    ap.add_argument('--quiet', action='store_true')
    ap.add_argument('--install-launchd', action='store_true')
    ap.add_argument('--uninstall-launchd', action='store_true')
    a = ap.parse_args(argv)
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if a.install_launchd: install_launchd(repo); return 0
    if a.uninstall_launchd: uninstall_launchd(); return 0
    log = (lambda *x: None) if a.quiet else print
    if not a.key and not a.dry_run:
        sys.exit('need --key or AXIOM_KEY (export it in ~/.zshrc so the background run can find it)')
    try:
        st = rdt_status()
        log('rdt: %s' % (st.get('message') or st.get('status') or json.dumps(st)[:120]))
    except RuntimeError as e:
        print('Reddit session check failed: %s' % e, file=sys.stderr); return 2
    subs = [s.strip().lstrip('r/') for s in a.subs.split(',') if s.strip()]
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    log('%s  sweeping %s' % (stamp, ', '.join('r/' + s for s in subs)))
    try:
        trows, crows, errors = sweep(subs, a.per_sub, a.threads, a.comments, log=log)
    except RuntimeError as e:
        print('Sweep stopped: %s' % e, file=sys.stderr); return 2
    log('collected %d threads, %d comments%s' % (len(trows), len(crows), (' (%d fetch errors)' % len(errors)) if errors else ''))
    for e in errors[:3]: log('  ' + e)
    if not trows and not errors:
        # every listing answered but nothing parsed: show one raw answer so the shape can be seen, never a silent zero
        try:
            sample = run_rdt(['sub', subs[0], '-s', 'hot', '-n', '2', '-c'])
            print('rdt answered but no posts were recognised. Raw sample from r/%s: %s' % (subs[0], json.dumps(sample)[:600]), file=sys.stderr)
        except RuntimeError as e:
            print('rdt sample failed: %s' % e, file=sys.stderr)
    tagged = sum(1 for r in trows if r['meta']['issues'])
    hostile = sum(1 for r in crows if r['tone'] < 0)
    log('on our issues: %d threads; hostile comments: %d of %d' % (tagged, hostile, len(crows)))
    if a.out:
        with open(a.out, 'w') as f:
            json.dump({'generated': stamp, 'batches': [{'kind': 'reddit_thread', 'rows': trows}, {'kind': 'reddit_comment', 'rows': crows}]}, f)
        log('wrote %s' % a.out)
    if a.dry_run: return 0
    if not trows: print('nothing to file', file=sys.stderr); return 1
    b_t, b_c = kind_count(a.worker, 'reddit_thread'), kind_count(a.worker, 'reddit_comment')
    n_t, tot_t = push(a.worker, a.key, 'reddit_thread', trows)
    n_c, tot_c = push(a.worker, a.key, 'reddit_comment', crows)
    a_t, a_c = kind_count(a.worker, 'reddit_thread'), kind_count(a.worker, 'reddit_comment')
    print('%s  filed %d new threads (+%d) and %d new comments (+%d); archive holds %s threads, %s comments' % (
        stamp, n_t, (a_t - b_t) if a_t is not None and b_t is not None else 0, n_c, (a_c - b_c) if a_c is not None and b_c is not None else 0,
        a_t if a_t is not None else tot_t, a_c if a_c is not None else tot_c))
    if a_t is not None and b_t is not None and a_t == b_t and trows and n_t:
        print('WARNING: the worker accepted rows but the archive did not grow - check the worker URL and key', file=sys.stderr); return 3
    return 0


if __name__ == '__main__':
    sys.exit(main())
