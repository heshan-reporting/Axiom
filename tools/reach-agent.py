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

Needs: rdt (Reddit) and/or twitter (X) on PATH, signed in. It reports which
collectors are available when it connects, and AXIOM shows that in Signals.
"""
import argparse, datetime, importlib.util, json, os, shutil, subprocess, sys, time, urllib.error, urllib.request

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


def collectors():
    """Which sources this machine can actually collect, checked not assumed."""
    out = []
    if have('rdt'): out.append('reddit')
    if have('twitter'): out.append('x')
    return out


# ---- the jobs ---------------------------------------------------------------
def job_reddit(worker, key, params, log):
    sel = [s for s in str(params.get('issue') or '').split(',') if s.strip()]
    q = params.get('queries', 'auto')
    queries = rr.queries_for(sel) if q == 'auto' else ([str(x) for x in q] if isinstance(q, list) else [])
    subs = params.get('subs') or rr.SUBS
    log('info', 'Reddit: %d subs, %d client keywords' % (len(subs), len(queries)))
    trows, crows, errors = rr.sweep(subs, int(params.get('perSub') or 25), int(params.get('threads') or 30),
                                    int(params.get('commentsPer') or 80), pace=float(params.get('pace') or 1.2),
                                    log=lambda *a: log('info', a[0] if len(a) == 1 else ' '.join(str(x) for x in a)),
                                    queries=queries, per_query=int(params.get('perQuery') or 25),
                                    when=str(params.get('time') or 'week'), cmdlog=log)
    n_t, tot_t = rr.push(worker, key, 'reddit_thread', trows)
    n_c, tot_c = rr.push(worker, key, 'reddit_comment', crows)
    return {'ok': True, 'platform': 'reddit', 'threads': len(trows), 'comments': len(crows),
            'threadRows': n_t, 'commentRows': n_c, 'hostile': sum(1 for r in crows if r['tone'] < 0),
            'errors': errors[:5], 'holds': {'threads': tot_t, 'comments': tot_c}}


def job_x(worker, key, params, log):
    sel = [s for s in str(params.get('issue') or '').split(',') if s.strip()]
    q = params.get('queries', 'auto')
    queries = rr.queries_for(sel) if q == 'auto' else ([str(x) for x in q] if isinstance(q, list) else [])
    log('info', 'X: %d client keywords, %s window' % (len(queries), params.get('time') or 'week'))
    st = rx.status()
    log('out', 'twitter session: %s' % ('signed in' if (st or {}).get('authenticated', True) else 'not signed in'))
    trows, crows, errors, found = rx.sweep(queries, int(params.get('perQuery') or 25), int(params.get('threads') or 20),
                                           int(params.get('commentsPer') or 40), str(params.get('time') or 'week'),
                                           pace=float(params.get('pace') or 1.5), log=log)
    n_t, tot_t = rr.push(worker, key, 'sig_thread', trows)
    n_c, tot_c = rr.push(worker, key, 'sig_comment', crows)
    return {'ok': True, 'platform': 'x', 'found': found, 'threads': len(trows), 'comments': len(crows),
            'threadRows': n_t, 'commentRows': n_c, 'hostile': sum(1 for r in crows if r['tone'] < 0),
            'errors': errors[:5], 'holds': {'threads': tot_t, 'comments': tot_c}}


JOBS = {'reddit': job_reddit, 'x': job_x}


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
