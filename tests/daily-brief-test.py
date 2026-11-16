#!/usr/bin/env python3
"""tools/daily-brief.py's narrative drain (build p68, 16 November 2026): when it keeps going and when it stops. No network:
the worker is a stand-in that answers each step from a script. On 16 November 2026 the drain stopped after one failed naming
batch ("nothing was named this step; stopping") with 642 narratives waiting, and spent 400 place steps on rows that never
stayed placed. Six of the nine cases fail on p67's tool (the other three hold already and stay held)."""
import os, sys, io, contextlib, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.join(HERE, '..', 'tools')
spec = importlib.util.spec_from_file_location('daily_brief', os.path.join(TOOLS, 'daily-brief.py')); db = importlib.util.module_from_spec(spec); spec.loader.exec_module(db)

passed = failed = 0
def t(name, cond, detail=''):
    global passed, failed
    if cond: passed += 1; print('  ok   ' + name)
    else: failed += 1; print('  FAIL ' + name + (' - ' + str(detail)[:600] if detail else ''))

def run(names, places=None):
    """Drain with a stand-in worker: `names` is the list of answers to successive name steps, `places` to place steps."""
    sent = []; places = list(places or [{'scanned': 0, 'placed': 0, 'remaining': 0}]); names = list(names)
    def call(worker, key, path, body=None, timeout=240):
        sent.append((path, (body or {}).get('what')))
        if path == '/narratives/status': return {'ok': True, 'backlog': 0, 'live': 1, 'budget': {'used': 0, 'cap': 120, 'model': 'm'}}
        what = (body or {}).get('what')
        if what == 'place': return dict(places.pop(0) if places else {'scanned': 0, 'placed': 0, 'remaining': 0}, ok=True, what='place')
        if what == 'recount': return {'ok': True, 'what': 'recount', 'recounted': 0, 'remaining': 0}
        if what == 'name': return dict(names.pop(0) if names else {'named': 0, 'calls': 0, 'remaining': 0}, ok=True, what='name')
        return {}
    db.call = call; out = io.StringIO()
    with contextlib.redirect_stdout(out): r = db.drain_narratives('https://worker.test', 'k', 400)
    return r, [w for p, w in sent if w == 'name'], [w for p, w in sent if w == 'place'], out.getvalue()

print('daily-brief narrative drain')
FAILED = {'named': 0, 'calls': 4, 'remaining': 637, 'setAside': 0, 'claimed': 5, 'errors': ['the naming model answered without valid JSON for nq1, nq2 (not JSON: "These clusters...")']}
r, names, _, out = run([FAILED, {'named': 5, 'calls': 1, 'remaining': 632}, {'named': 5, 'calls': 1, 'remaining': 0}])
t('a step that names nothing but made a call, with names still waiting, does not stop the drain', len(names) == 3 and '10 narratives named' in out, out)

r, names, _, out = run([FAILED, {'named': 0, 'calls': 0, 'remaining': 5, 'claimed': 5}, {'named': 5, 'calls': 1, 'remaining': 0}])
t('one step with no call is not yet a stop (another drain may hold the claims)', len(names) == 3, out)

r, names, _, out = run([FAILED, {'named': 0, 'calls': 0, 'remaining': 5}, {'named': 0, 'calls': 0, 'remaining': 5}, {'named': 5, 'calls': 1, 'remaining': 0}])
t('two consecutive steps with no call stop it', len(names) == 3 and 'no call' in out, out)

r, names, _, out = run([{'named': 2, 'calls': 2, 'remaining': 40, 'stopped': 'budget', 'errors': ['budget_exhausted: 120 of 120 narratives calls used today (not retried)']}, {'named': 5, 'calls': 1, 'remaining': 0}])
t('the day\'s budget stops it (budget_exhausted, or stopped: budget)', len(names) == 1 and 'budget' in out, out)

r, names, _, out = run([{'named': 0, 'calls': 1, 'remaining': 40, 'stopped': 'budget', 'errors': []}, {'named': 5, 'calls': 1, 'remaining': 0}])
t('stopped: budget alone stops it', len(names) == 1, out)

r, names, _, out = run([{'named': 0, 'calls': 1, 'remaining': 40, 'errors': ['Your credit balance is too low to access the Anthropic API']}, {'named': 5, 'calls': 1, 'remaining': 0}])
t('an account limit stops it', len(names) == 1 and 'spend limit' in out, out)

r, names, _, out = run([{'named': 5, 'calls': 1, 'remaining': 3, 'setAside': 2}, {'named': 3, 'calls': 1, 'remaining': 0, 'setAside': 2}])
t('remaining 0 ends it, and the narratives set aside are reported', len(names) == 2 and '2 set aside after three failures' in out, out)

stuck = [{'scanned': 100, 'placed': 100, 'started': 100, 'remaining': 132}] * 30
r, _, places, out = run([{'named': 0, 'calls': 0, 'remaining': 0}], stuck)
t('a place loop whose remaining never falls stops after ten steps instead of four hundred', len(places) <= 11 and 'not falling' in out, '%d place steps; %s' % (len(places), out[-400:]))

falling = [{'scanned': 100, 'placed': 100, 'remaining': 300 - 100 * i} for i in range(4)]
r, _, places, out = run([{'named': 0, 'calls': 0, 'remaining': 0}], falling)
t('a place loop that makes progress runs to remaining 0', len(places) == 4, '%d place steps' % len(places))

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
