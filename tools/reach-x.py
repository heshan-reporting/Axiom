#!/usr/bin/env python3
"""
reach-x.py - sweep X (Twitter) for what is being said about our clients, from a
machine that is logged in, and file it in AXIOM's archive.

Why this exists. X has no free read API and refuses cloud networks; the only
reliable reader is a browser session. twitter-cli (public-clis/twitter-cli,
binary `twitter`) uses the cookies of a browser already signed in to x.com. This
script drives it with the client keywords from AXIOM's own lexicon, reads the
replies under the posts that matter, tone-scores every reply and files rows in
exactly the shape the worker writes: kind `sig_thread` and `sig_comment` with
meta.platform 'x'. Handles and display names are never stored - the argument is
the signal, not the person.

Usage (on the Mac, from the repo):
  python3 tools/reach-x.py --key $AXIOM_KEY                    # sweep and file now
  python3 tools/reach-x.py --key $AXIOM_KEY --issue mca,activism --time day
  python3 tools/reach-x.py --out x-rows.json --dry-run         # rows file for the in-app Load data button

Normally you do not run this by hand: tools/reach-agent.py runs it when someone
presses Sweep in AXIOM. Needs `twitter` on PATH (uv tool install twitter-cli)
and a browser logged in to x.com (check with: twitter status).
"""
import argparse, datetime, importlib.util, json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
# the Reddit bridge owns the shared pieces: the client lexicon, tone, the push
_spec = importlib.util.spec_from_file_location('reach_reddit', os.path.join(HERE, 'reach-reddit.py'))
rr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rr)

WORKER = rr.WORKER
PLATFORM = 'x'


def run_twitter(args, timeout=90):
    """Run `twitter ... --json` and return its data payload."""
    try:
        p = subprocess.run(['twitter'] + list(args) + ['--json'], capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        raise RuntimeError("twitter-cli is not installed. Install it: uv tool install twitter-cli (or pipx install twitter-cli), then sign in to x.com in Chrome and run `twitter status`.")
    except subprocess.TimeoutExpired:
        raise RuntimeError('twitter timed out after %ds on: %s' % (timeout, ' '.join(args)))
    out = (p.stdout or '').strip()
    starts = [i for i in (out.find('{'), out.find('[')) if i >= 0]
    try:
        d = json.loads(out[min(starts):]) if starts else {}
    except Exception:
        d = {}
    if not d:
        raise RuntimeError('twitter returned no JSON for: %s%s' % (' '.join(args), (' - ' + (p.stderr or '').strip()[-200:]) if p.stderr else ''))
    if isinstance(d, list):
        return d
    if not d.get('ok', True):
        err = d.get('error') or {}
        msg = str(err.get('message') or err or 'unknown error')
        code = str(err.get('code') or '')
        if 'auth' in (msg + code).lower() or '401' in msg or '403' in msg or 'cookie' in msg.lower():
            msg += '. X needs a logged-in browser session: sign in to x.com in Chrome, Arc, Edge, Firefox or Brave on this Mac, then run `twitter status`.'
        if 'rate' in (msg + code).lower() or '429' in msg:
            msg += '. X is rate-limiting; wait 15 minutes.'
        raise RuntimeError('twitter %s: %s' % (code, msg))
    return d.get('data', d)


def status():
    return run_twitter(['status'], timeout=45)


def tweets_from(payload):
    """Tweets out of whatever twitter-cli hands back: a bare list, {data:[...]},
    or a single tweet object."""
    if isinstance(payload, dict):
        payload = payload.get('data', payload)
    if isinstance(payload, dict):
        payload = [payload] if payload.get('id') else []
    out = []
    for t in payload or []:
        if isinstance(t, dict) and t.get('id'):
            out.append(t)
    return out


def search(q, n, when='week', lang='en'):
    """One client keyword on X, newest first."""
    args = ['search', q, '-t', 'Latest', '-n', str(n), '--exclude', 'retweets']
    if lang: args += ['--lang', lang]
    days = {'day': 1, 'week': 7, 'month': 30, 'year': 365}.get(when, 7)
    if days:
        since = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)).strftime('%Y-%m-%d')
        args += ['--since', since]
    hits = tweets_from(run_twitter(args))
    for h in hits: h['_q'] = q
    return hits


def replies(tweet_id, n):
    """A post and the replies under it. twitter-cli returns the post first."""
    got = tweets_from(run_twitter(['tweet', str(tweet_id), '-n', str(n)]))
    return (got[0] if got else None), got[1:]


def metric(t, name):
    m = t.get('metrics') or {}
    return int(m.get(name) or 0)


def ts_of(t):
    for k in ('createdAtISO', 'createdAt'):
        v = t.get(k)
        if not v: continue
        try:
            return int(datetime.datetime.fromisoformat(str(v).replace('Z', '+00:00')).timestamp() * 1000)
        except Exception:
            continue
    return int(time.time() * 1000)


def thread_row(t):
    """kind sig_thread, exactly as the worker's sigThreadRow writes it."""
    text = str(t.get('text') or '')[:4000]
    title = text.split('\n')[0][:200] or 'Post on X'
    isu = rr.issues_of(text)
    score = metric(t, 'likes') + metric(t, 'retweets')
    ncom = metric(t, 'replies')
    # the /i/web/ form resolves without carrying the author's handle
    url = 'https://x.com/i/web/status/%s' % t.get('id')
    return {
        'src': PLATFORM, 'title': title,
        'body': text[:3000] + '\n%d reactions, %d comments' % (score, ncom),
        'url': url, 'author': '', 'tone': rr.tone(text), 'ts': ts_of(t),
        'meta': {'platform': PLATFORM, 'id': str(t.get('id') or ''), 'page': '', 'page_name': '', 'score': score,
                 'comments': ncom, 'link': url, 'issues': isu, 'issue': isu[0] if isu else '',
                 'q': str(t.get('_q') or ''), 'ns': '', 'via': 'reach'},
    }


def comment_rows(post, reps):
    """kind sig_comment for each reply, tagged with its own issues and the post's."""
    text = str(post.get('text') or '')
    title = text.split('\n')[0][:200] or 'Post on X'
    t_issues = rr.issues_of(text)
    tid = str(post.get('id') or '')
    permalink = 'https://x.com/i/web/status/%s' % tid
    rows = []
    for c in reps:
        body = str(c.get('text') or '').strip()
        if not body: continue
        allis = rr.merge_issues(rr.issues_of(body), t_issues)
        rows.append({
            'src': PLATFORM, 'title': 'Comment on: ' + title[:120], 'body': body[:3000],
            'url': 'x:sigc:%s:%s' % (PLATFORM, c.get('id')), 'author': '', 'tone': rr.tone(body), 'ts': ts_of(c),
            'meta': {'platform': PLATFORM, 'thread': tid, 'thread_title': title[:200], 'permalink': permalink,
                     'score': metric(c, 'likes'), 'depth': 0, 'issues': allis, 'issue': allis[0] if allis else '',
                     'tone': rr.tone(body), 'ns': '', 'via': 'reach'},
        })
    return rows


def sweep(queries, per_query=25, n_threads=20, n_replies=40, when='week', pace=1.5, log=print):
    """Search every client keyword, then read the replies under the posts that
    matter most: issue breadth first, then how much reply traffic they drew."""
    seen, errors, found = {}, [], 0
    for q in queries:
        log('cmd', 'twitter search "%s" -t Latest -n %d --exclude retweets' % (q, per_query))
        try:
            hits = search(q, per_query, when)
            found += len(hits)
            log('out', '"%s": %d posts' % (q, len(hits)))
            for t in hits:
                tid = str(t.get('id') or '')
                if tid and tid not in seen: seen[tid] = t
        except RuntimeError as e:
            errors.append('search "%s": %s' % (q, e)); log('err', str(e))
            if 'logged-in' in str(e) or 'not installed' in str(e): raise
            if 'rate-limiting' in str(e): break
        time.sleep(pace)
    posts = list(seen.values())
    weight = lambda t: len(rr.issues_of(str(t.get('text') or ''))) * 1000 + metric(t, 'replies') + metric(t, 'likes') // 10
    pick = sorted(posts, key=weight, reverse=True)[:n_threads]
    trows = [thread_row(t) for t in posts]
    crows = []
    for t in pick:
        tid = str(t.get('id'))
        log('cmd', 'twitter tweet %s -n %d' % (tid, n_replies))
        try:
            post, reps = replies(tid, n_replies)
            rows = comment_rows(post or t, reps)
            crows.extend(rows)
            log('out', '%s: %d replies - %s' % (tid, len(rows), str(t.get('text') or '')[:70].replace('\n', ' ')))
        except RuntimeError as e:
            errors.append('%s: %s' % (tid, e)); log('err', str(e))
            if 'rate-limiting' in str(e): break
        time.sleep(pace)
    return trows, crows, errors, found


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--queries', default='auto', help="client keywords: 'auto' (all), or a comma-separated list")
    ap.add_argument('--issue', default='', help='limit to these issue ids or client namespaces (comma-separated)')
    ap.add_argument('--per-query', type=int, default=25)
    ap.add_argument('--threads', type=int, default=20, help='posts whose replies to read')
    ap.add_argument('--comments', type=int, default=40, help='replies per post')
    ap.add_argument('--time', dest='when', default='week', choices=['day', 'week', 'month', 'year'])
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--worker', default=WORKER)
    ap.add_argument('--out', help='also write the rows to this JSON file ({batches:[...]}, loadable in-app)')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args(argv)
    log = (lambda *x: None) if a.quiet else (lambda k, t: print(('  ' if k == 'out' else '') + t))
    if not a.key and not a.dry_run:
        sys.exit('need --key or AXIOM_KEY (export it in ~/.zshrc so the background run can find it)')
    rr.load_lexicon(a.worker, a.key, None if a.quiet else print)
    sel = [s for s in a.issue.split(',') if s.strip()]
    queries = rr.queries_for(sel) if a.queries.strip().lower() == 'auto' else [q.strip() for q in a.queries.split(',') if q.strip()]
    try:
        st = status()
        log('info', 'twitter: %s' % (st.get('user', {}).get('screenName') and 'signed in' or json.dumps(st)[:100]))
    except RuntimeError as e:
        print('X session check failed: %s' % e, file=sys.stderr); return 2
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    log('info', '%s  searching X for %d client keywords' % (stamp, len(queries)))
    try:
        trows, crows, errors, found = sweep(queries, a.per_query, a.threads, a.comments, a.when, log=log)
    except RuntimeError as e:
        print('Sweep stopped: %s' % e, file=sys.stderr); return 2
    hostile = sum(1 for r in crows if r['tone'] < 0)
    log('info', 'collected %d posts and %d replies (%d hostile)%s' % (len(trows), len(crows), hostile, (' - %d errors' % len(errors)) if errors else ''))
    if a.out:
        with open(a.out, 'w') as f:
            json.dump({'generated': stamp, 'batches': [{'kind': 'sig_thread', 'rows': trows}, {'kind': 'sig_comment', 'rows': crows}]}, f)
        log('info', 'wrote %s' % a.out)
    if a.dry_run: return 0
    if not trows:
        print('nothing to file', file=sys.stderr); return 1
    n_t, tot_t = rr.push(a.worker, a.key, 'sig_thread', trows)
    n_c, tot_c = rr.push(a.worker, a.key, 'sig_comment', crows)
    print('%s  filed %d posts and %d replies from X; archive holds %s signal posts, %s signal comments' % (stamp, n_t, n_c, tot_t, tot_c))
    return 0


if __name__ == '__main__':
    sys.exit(main())
