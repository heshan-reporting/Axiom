#!/usr/bin/env python3
"""The Mac collectors' calls to the worker (collection hardening, p65). Nothing is contacted: urlopen is a stand-in.
  what is proven, for both copies of the helper (reach-reddit.py and reach_social.py): a GET is asked once more after
  a 5xx, a dropped connection or a timeout, and only once more; a 429 or 503 waits what Retry-After says, capped; a
  POST is asked again only when the server said it did not take it (429, 503) and never after a dropped connection;
  a 4xx is never asked again; the job claim is never asked twice; every call carries a timeout."""
import io, os, sys, json, importlib.util, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.join(HERE, '..', 'tools'); sys.path.insert(0, TOOLS)
def load(name, fn):
    spec = importlib.util.spec_from_file_location(name, os.path.join(TOOLS, fn)); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

passed = failed = 0
def t(name, cond, detail=''):
    global passed, failed
    if cond: passed += 1; print('  ok   ' + name)
    else: failed += 1; print('  FAIL ' + name + (' - ' + str(detail)[:400] if detail else ''))

class Resp:
    def __init__(self, body): self.b = json.dumps(body).encode()
    def read(self): return self.b
    def __enter__(self): return self
    def __exit__(self, *a): return False
def err(code, headers=None): return urllib.error.HTTPError('https://w.test/x', code, 'err', headers or {}, io.BytesIO(b'{}'))

for label, fn in (('reach-reddit', 'reach-reddit.py'), ('reach_social', 'reach_social.py')):
    m = load(label.replace('-', '_'), fn); print(label)
    def run(answers, url='https://w.test/archive/stats', body=None):
        calls, slept = [], []
        def urlopen(req, timeout=None):
            calls.append({'method': req.get_method(), 'timeout': timeout}); a = answers[min(len(calls) - 1, len(answers) - 1)]
            if isinstance(a, Exception): raise a
            return Resp(a)
        real_open, real_sleep = m.urllib.request.urlopen, m._http_sleep
        m.urllib.request.urlopen = urlopen; m._http_sleep = slept.append
        try:
            try: out = m.http_json(url, 'k', body); bad = None
            except Exception as e: out = None; bad = e
        finally: m.urllib.request.urlopen = real_open; m._http_sleep = real_sleep
        return out, bad, calls, slept
    out, bad, calls, slept = run([err(502), {'ok': True}])
    t('a GET is asked once more after a 5xx, after a wait', out == {'ok': True} and len(calls) == 2 and len(slept) == 1 and 1.5 <= slept[0] < 2.6, (out, bad, calls, slept))
    out, bad, calls, slept = run([err(500), err(500), {'ok': True}])
    t('and only once more', out is None and isinstance(bad, urllib.error.HTTPError) and len(calls) == 2, (bad, calls))
    out, bad, calls, slept = run([urllib.error.URLError('connection reset'), {'ok': 1}])
    t('a GET is asked once more after a dropped connection', out == {'ok': 1} and len(calls) == 2)
    out, bad, calls, slept = run([TimeoutError('timed out'), {'ok': 1}])
    t('and after a timeout', out == {'ok': 1} and len(calls) == 2)
    out, bad, calls, slept = run([err(429, {'Retry-After': '7'}), {'ok': 1}])
    t('a 429 waits what Retry-After says', out == {'ok': 1} and 7 <= slept[0] < 8.1, slept)
    out, bad, calls, slept = run([err(503, {'Retry-After': '900'}), {'ok': 1}])
    t('capped at thirty seconds inside one call', out == {'ok': 1} and 30 <= slept[0] < 31.1, slept)
    out, bad, calls, slept = run([err(404), {'ok': 1}])
    t('a 4xx is never asked again', isinstance(bad, urllib.error.HTTPError) and bad.code == 404 and len(calls) == 1)
    out, bad, calls, slept = run([urllib.error.URLError('reset'), {'ok': 1}], body={'rows': []})
    t('a POST is not repeated after a dropped connection (it may have landed)', isinstance(bad, urllib.error.URLError) and len(calls) == 1 and calls[0]['method'] == 'POST')
    out, bad, calls, slept = run([err(500), {'ok': 1}], body={'rows': []})
    t('nor after a 500', bad is not None and len(calls) == 1)
    out, bad, calls, slept = run([err(503, {'Retry-After': '2'}), {'ok': 1}], body={'rows': []})
    t('a POST the server said it did not take (503) is asked once more', out == {'ok': 1} and len(calls) == 2)
    out, bad, calls, slept = run([err(502), {'ok': True, 'job': {'id': 'j1'}}], url='https://w.test/bridge/next?agent=a&sources=reddit')
    t('the job claim is never asked twice', bad is not None and len(calls) == 1, calls)
    t('every call carries a timeout', all(c['timeout'] for c in calls))

print('\n%d passed, %d failed' % (passed, failed)); sys.exit(1 if failed else 0)
