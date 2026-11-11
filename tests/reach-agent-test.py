#!/usr/bin/env python3
"""The Mac collector and X search that does not work (the first live run, 11 November 2026). twitter-cli and the worker
are stand-ins; nothing is signed in to, nothing is fetched, no handle is real.
  what is proven: the message a person reads puts what to do before why, and the remedy survives every cut on the way
  to the console; after one job learns X search is unavailable the agent stops offering X, says so once, tells the
  worker, and claims no further X job; it rechecks on the ten-minute rhythm and offers X again when search works; a
  machine whose X search is already broken when the agent starts never offers it; --channels says so in words.
  what is NOT proven here: that the upgrade command repairs twitter-cli on the Mac - only running it there shows that."""
import io, os, sys, json, tempfile, importlib.util, contextlib, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.join(HERE, '..', 'tools'); sys.path.insert(0, TOOLS)
os.environ['AXIOM_REACH_HOME'] = tempfile.mkdtemp()
def load(name, fn):
    spec = importlib.util.spec_from_file_location(name, os.path.join(TOOLS, fn)); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
agent = load('reach_agent', 'reach-agent.py')
rx = agent.rx

passed = failed = 0
def t(name, cond, detail=''):
    global passed, failed
    if cond: passed += 1; print('  ok   ' + name)
    else: failed += 1; print('  FAIL ' + name + (' - ' + str(detail)[:600] if detail else ''))

COMMAND = 'uv tool upgrade twitter-cli'

# ---- B, D: the message --------------------------------------------------------------------------------------------
broken = {'v': True}
rx.transaction_generator_broken = lambda: broken['v']
try: rx.assert_searchable(); msg = ''
except rx.XUnavailable as e: msg = str(e)
t('X search that cannot work raises its own error', bool(msg))
t('the message says what to do before it says why', COMMAND in msg and 'x-client-transaction-id' in msg and msg.index(COMMAND) < msg.index('x-client-transaction-id'), msg)
t('the command is inside the first 300 characters, so no cut on the way loses it', COMMAND in msg[:300], msg[:300])
t('it names the check that shows whether the upgrade worked', 'reach-agent.py --channels' in msg[:400], msg[:400])
t('it does not promise the upgrade is a fix', 'may not' in msg or 'only if' in msg, msg)
t('the whole message fits one console line (1,200 characters)', len(msg) <= 1200, len(msg))
t('a 404 on search with the generator warning on stderr carries the same remedy', COMMAND in rx.TRANSACTION_HINT and 'x-client-transaction-id' in rx.TRANSACTION_HINT)

# ---- the stand-in worker: a queue of X jobs, handed out only to a collector that offers X ---------------------------
class Worker:
    def __init__(self, n):
        self.queue = [{'id': 'j%d' % i, 'source': 'x', 'params': {'queries': ['kw%d' % i]}} for i in range(n)]
        self.polls, self.done, self.logs = [], [], []
    def http(self, url, key, body=None, timeout=30):
        u = urllib.parse.urlparse(url); q = urllib.parse.parse_qs(u.query)
        if u.path == '/bridge/next':
            sources = [s for s in (q.get('sources') or [''])[0].split(',') if s]; down = [s for s in (q.get('down') or [''])[0].split(',') if s]
            self.polls.append({'sources': sources, 'down': down})
            for j in list(self.queue):
                if j['source'] in sources: self.queue.remove(j); return {'ok': True, 'job': j}
            return {'ok': True, 'job': None}
        if u.path == '/bridge/log': self.logs.extend(body['lines']); return {'ok': True}
        if u.path == '/bridge/done': self.done.append(body); return {'ok': True}
        return {'ok': True}

def setup(n=16, twitter=True):
    w = Worker(n); agent.rr.http_json = w.http
    agent.have = lambda b: (b == 'twitter' and twitter) or b == 'rdt'
    agent.have_playwright = lambda: False
    agent.rs.offered = lambda runner=None: []
    agent.X_DOWN.clear()
    return w
ran = []; probes = {'n': 0}; fixed_at = {'t': None}
def probe(): probes['n'] += 1; return broken['v']
rx.transaction_generator_broken = probe
def job_x(worker, key, params, log):
    ran.append(params); log('out', 'twitter session: signed in')
    if len(ran) == 1: broken['v'] = True                           # the generator breaks under the first job
    probes['n'] -= 1; rx.assert_searchable(); return {'ok': True, 'platform': 'x'}   # the job's own check is not a recheck
agent.JOBS['x'] = job_x

# ---- A: one job learns it, the agent stops, and looks again every ten minutes --------------------------------------
# one run of the loop on a clock the test owns: a poll a minute; twitter-cli is repaired at t=2000
w = setup(); broken['v'] = False
clock = {'t': 1000.0}; said = []; marks = []
def sleep(sec):
    clock['t'] += sec
    if clock['t'] >= 2000 and fixed_at['t'] is None: broken['v'] = False; fixed_at['t'] = clock['t']
    marks.append((clock['t'], len(w.polls), probes['n']))
t('the agent has a loop that can be driven', hasattr(agent, 'serve'))
agent.serve('https://x.workers.test', 'k', 'macbook', [], poll=60, say=said.append, echo=False, sleep=sleep, clock=lambda: clock['t'], rounds=30)
first_stop = next(i for i, p in enumerate(w.polls) if 'x' not in p['sources'])
back = next((i for i, p in enumerate(w.polls) if i > first_stop and 'x' in p['sources']), None)
t('with search working at the start, X is offered', 'x' in w.polls[0]['sources'] and w.polls[0]['down'] == [], w.polls[0])
t('the first X job is reported as x_unavailable, failed', w.done[0]['ok'] is False and w.done[0]['result']['error'] == 'x_unavailable', w.done[:1])
t('the report carries the command, not a sentence cut before it', COMMAND in w.done[0]['result']['detail'], w.done[0]['result'].get('detail'))
errs = [l['t'] for l in w.logs if l['k'] == 'err']
t('the console line carries the command too', len(errs) == 1 and COMMAND in errs[0] and len(errs[0]) <= 1200, errs)
t('sixteen X jobs wait; while search is down the agent claims one, not sixteen', first_stop == 1 and back is not None and len([d for d in w.done if d['ok'] is False]) == 1, (first_stop, back, len(w.done)))
t('while it is down X is not offered, and the worker is told', all('x' not in p['sources'] and p['down'] == ['x'] for p in w.polls[first_stop:back]), w.polls[first_stop:back][:3])
t('Reddit is still offered throughout', all('reddit' in p['sources'] for p in w.polls))
stopped = [x for x in said if 'no longer offering X' in x]
t('the agent says so once, in words, with the command', len(stopped) == 1 and COMMAND in stopped[0], said)
# checks outside jobs: one at the start (t=1000), one at ten minutes (still broken), one at twenty (repaired)
t('twitter-cli is asked again only every ten minutes: three checks in twenty minutes, not one a poll', probes['n'] == 3, (probes, marks[:25]))
t('when search works again X is offered again, and said once', back is not None and w.polls[back]['down'] == [] and len([x for x in said if 'offering X again' in x]) == 1, said[-4:])
t('and the waiting jobs are then taken', len(ran) > 1 and all(d['ok'] for d in w.done[1:]), (len(ran), w.done[1:3]))

def job_x_broken(worker, key, params, log):
    ran.append(params); rx.assert_searchable(); return {'ok': True}
# ---- A: broken from the start; a fixed --sources list; --channels ---------------------------------------------------
w = setup(4); broken['v'] = True; said.clear(); ran.clear(); agent.JOBS['x'] = job_x_broken
agent.serve('https://x.workers.test', 'k', 'macbook', [], poll=15, say=said.append, echo=False, sleep=lambda s: None, clock=lambda: 5000.0, rounds=3)
t('a machine whose X search is broken when the agent starts never offers X', len(ran) == 0 and all('x' not in p['sources'] and p['down'] == ['x'] for p in w.polls) and len(w.polls) == 3, w.polls)
t('and says why at the start, once', len([s for s in said if COMMAND in s]) == 1, said)
w = setup(4); said.clear()
agent.serve('https://x.workers.test', 'k', 'macbook', ['x', 'reddit'], poll=15, say=said.append, echo=False, sleep=lambda s: None, clock=lambda: 5000.0, rounds=3)
t('naming --sources x does not override it', len(ran) == 0 and all(p['sources'] == ['reddit'] for p in w.polls), w.polls)
setup(0); agent.rs.status = lambda c, runner=None, now=None: {'usable': False, 'status': 'not installed', 'why': '', 'reads_today': 0, 'per_day': 0}
buf = io.StringIO()
with contextlib.redirect_stdout(buf): agent.main(['--channels'])
line = [l for l in buf.getvalue().splitlines() if l.startswith('x ')]
t('--channels says X search is unavailable, with the command, not "usable"', len(line) == 1 and line[0].split()[1] != 'usable' and 'search is unavailable' in line[0] and COMMAND in line[0], buf.getvalue())
broken['v'] = False; buf = io.StringIO()
with contextlib.redirect_stdout(buf): agent.main(['--channels'])
t('and "usable" when search works', any(l.startswith('x ') and l.split()[1] == 'usable' for l in buf.getvalue().splitlines()), buf.getvalue())
setup(0, twitter=False); buf = io.StringIO()
with contextlib.redirect_stdout(buf): agent.main(['--channels'])
t('and "not installed" when twitter-cli is absent', any(l.startswith('x ') and 'not installed' in l for l in buf.getvalue().splitlines()), buf.getvalue())

# ---- names: nothing in the report names an account ------------------------------------------------------------------
t('no handle or name travels in the failure report', 'screenName' not in json.dumps(w.done) and '@' not in msg)

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
