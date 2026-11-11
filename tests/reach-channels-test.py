#!/usr/bin/env python3
"""The Mac collector's social channels (release 3): Facebook, Instagram and YouTube through agent-reach. agent-reach is a
stand-in here - a function that answers as its documentation says it does - and so is the worker. Nothing is signed in to,
nothing is fetched. Every account, post and person is invented.
  what is proven: readiness is checked, not assumed (not installed, not signed in, off, paused, healthy); a row carries
  words, address, counts and nothing that names a person; a login wall, a verification, a slow-down and an unreadable
  answer each stop the sweep with their own name; three unreadable answers pause the platform; the pace and the daily cap
  hold across two runs; a cookie-shaped string never reaches a log; the job reads each desk's plan and hands its posts to
  /signals/ingest as layer 2; signing in shows the warning and stops on the wrong answer; the agent offers a channel only
  when it is usable."""
import os, sys, json, tempfile, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.join(HERE, '..', 'tools'); sys.path.insert(0, TOOLS)
os.environ['AXIOM_REACH_HOME'] = tempfile.mkdtemp()
def load(name, fn):
    spec = importlib.util.spec_from_file_location(name, os.path.join(TOOLS, fn)); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
rs = load('reach_social', 'reach_social.py')

passed = failed = 0
def t(name, cond, detail=''):
    global passed, failed
    if cond: passed += 1; print('  ok   ' + name)
    else: failed += 1; print('  FAIL ' + name + (' - ' + str(detail)[:500] if detail else ''))
def fresh():
    rs.HOME = tempfile.mkdtemp(); return rs.HOME
def raises(fn, kind):
    try: fn()
    except kind as e: return e
    except Exception as e: return None
    return None

J = lambda o: (0, json.dumps(o) + '\n', '')
DOCTOR = {'channels': [{'name': 'facebook', 'status': 'ready'}, {'name': 'instagram', 'status': 'search_ready'}, {'name': 'youtube', 'status': 'ready'}, {'name': 'twitter', 'status': 'needs_login'}]}
FB_ITEM = {'title': 'Harbour Watch', 'url': 'https://www.facebook.com/108000000000001_990000000000002', 'author': 'Jo Citizen', 'published_at': '2026-11-10T02:00:00Z',
           'text': 'Sign the gas export tax petition, Canberra', 'raw': {'author_id': '555', 'from': {'name': 'Jo Citizen'}, 'reaction_count': '1.2K', 'comment_count': 25, 'share_count': {'count': 12}}}
IG_ITEM = {'title': '', 'url': 'https://www.instagram.com/reel/DAbCdEfGhI3/?igsh=x', 'author': 'harbour.watch', 'published_at': 1794276000, 'text': 'A gas export tax would fund hospitals', 'raw': {'like_count': 900, 'comments_count': 40, 'play_count': 15000}}
YT_ITEM = {'title': 'Why a gas export tax would work', 'url': 'https://youtu.be/dQw4w9WgXcQ', 'author': 'Sam Private', 'text': 'An explainer.', 'raw': {'view_count': '34,000', 'like_count': 800}}

def mk(answers=None, doctor=DOCTOR, calls=None):
    """An agent-reach that answers by channel and action; `answers[(channel, action)]` is a result, a list of them, or a function of the argument."""
    answers = answers or {}; calls = calls if calls is not None else []
    def runner(cmd, timeout):
        calls.append(cmd[1:])
        if cmd[1] == 'doctor': return J(doctor) if not isinstance(doctor, str) else (0, doctor, '')
        a = answers.get((cmd[1], cmd[2]), {'ok': True, 'items': []})
        if callable(a): a = a(cmd[3])
        if isinstance(a, list): a = a.pop(0) if len(a) > 1 else a[0]
        return a if isinstance(a, tuple) else J(a)
    return runner, calls
PLAN = {'ok': True, 'ns': 'aep', 'queries': ['gas export tax', 'scott reef', 'windfall tax gas australia'], 'plan': {'facebook': {'accounts': []}, 'youtube': {'accounts': []},
        'instagram': {'accounts': [{'id': 'w2', 'value': 'harbour.watch'}, {'id': 'w5', 'value': 'baykeepers'}]}}}
lines = []; log = lambda k, x: lines.append((k, x)); naps = []

print('reach social channels')
# ---- readiness ----
fresh(); r, _ = mk()
t('a healthy channel is usable, with today\'s reads against the cap', rs.status('facebook', runner=r)['usable'] and rs.status('facebook', runner=r)['per_day'] == 120 and rs.status('instagram', runner=r)['status'] == 'search_ready')
t('the agent would offer exactly the usable channels, under their job names', rs.offered(runner=r) == ['facebook', 'instagram', 'ytsearch'], rs.offered(runner=r))
r2, _ = mk(doctor={'channels': [{'name': 'facebook', 'status': 'needs_login'}, {'name': 'instagram', 'status': 'broken'}]})
e = raises(lambda: rs.assert_ready('facebook', runner=r2), rs.Unavailable)
t('not signed in is said, with the command a person runs', bool(e) and e.why == 'needs_login' and '--login facebook' in str(e), e)
t('a broken channel and one agent-reach does not list are not offered', rs.offered(runner=r2) == [] and rs.status('youtube', runner=r2)['status'] == 'unknown')
r3, _ = mk(doctor='facebook      ready\ninstagram     needs_login\nyoutube       cooldown\n')
t('doctor\'s plain text is read when it is not JSON', rs.status('facebook', runner=r3)['usable'] and rs.status('instagram', runner=r3)['status'] == 'needs_login' and 'cooldown' in rs.status('youtube', runner=r3)['why'])
rs._write('reach.json', {'facebook': {'enabled': False}, 'instagram': {'pace': 1, 'per_day': 5}})
t('a platform switched off on this machine is not offered', not rs.status('facebook', runner=r)['usable'] and 'switched off' in rs.status('facebook', runner=r)['why'])
t('the pace cannot be set under ten seconds', rs.settings('instagram')['pace'] == 10.0 and rs.settings('instagram')['per_day'] == 5)
real_which = rs.shutil.which; rs.shutil.which = lambda b: None
e = raises(lambda: rs.assert_ready('youtube'), rs.Unavailable)
t('not installed is said, with how to install it', bool(e) and e.why == 'not_installed' and 'agent-reach setup' in str(e), e)
rs.shutil.which = real_which

# ---- rows ----
row = rs.item_row('facebook', FB_ITEM, 1794300000000, q='gas export tax')
t('a Facebook item becomes a row with its canonical address, words, time and counts', bool(row) and row['url'] == 'https://www.facebook.com/108000000000001/posts/990000000000002' and row['eng'] == {'likes': 1200, 'comments': 25, 'shares': 12} and row['ts'] == 1794276000000 and row['q'] == 'gas export tax', row)
ig = rs.item_row('instagram', IG_ITEM, 1, watch='w2')
t('an Instagram reel is filed under its post address, tied to the register row', bool(ig) and ig['url'] == 'https://www.instagram.com/p/DAbCdEfGhI3/' and ig['watch'] == 'w2' and ig['eng'] == {'likes': 900, 'comments': 40, 'views': 15000} and ig['ts'] == 1794276000000, ig)
yt = rs.item_row('youtube', YT_ITEM, 1)
t('a YouTube item keeps its title with its description', bool(yt) and yt['url'] == 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' and yt['text'].startswith('Why a gas export tax would work\n') and yt['eng'] == {'likes': 800, 'views': 34000}, yt)
blob = json.dumps([row, ig, yt])
t('nothing that names a person is in a row', not any(x in blob for x in ('Jo Citizen', 'Sam Private', 'author', '555')) and 'harbour.watch' not in blob, blob[:300])
t('an account page, an item with no words and a non-item are not rows', rs.item_row('facebook', {'url': 'https://www.facebook.com/harbourwatch', 'text': 'x y z'}, 1) is None and rs.item_row('instagram', {'url': 'https://www.instagram.com/p/DAbCdEfGhI3/', 'text': ''}, 1) is None and rs.item_row('youtube', 'nope', 1) is None)

# ---- a sweep: pace, caps, what stops it ----
fresh(); calls = []; r, calls = mk({('facebook', 'search'): {'ok': True, 'items': [FB_ITEM, dict(FB_ITEM, url='https://www.facebook.com/harbourwatch')]}}, calls=[])
naps = []; lines = []
rows, st = rs.sweep('facebook', PLAN, log=log, runner=r, sleep=naps.append, clock=lambda: 1794300000)
t('one read a keyword, at the platform\'s pace, one post once', (st['reads'], len(rows), naps, st['unusable']) == (3, 1, [12, 12], 3), (st, naps))
t('each read is logged as the command it ran', [x for k, x in lines if k == 'cmd'][0] == 'agent-reach facebook search "gas export tax" --limit 10', lines[:2])
t('the reads are counted against today', rs.state('facebook', 1794300000)['reads'] == 3)
rs._write('reach.json', {'facebook': {'per_day': 4, 'per_run': 30}})
rows, st = rs.sweep('facebook', PLAN, log=log, runner=r, sleep=naps.append, clock=lambda: 1794300000)
t('a second run reads only what the day still allows, and says what it held back', (st['reads'], st['held_back']) == (1, 2), st)
e = raises(lambda: rs.sweep('facebook', PLAN, log=log, runner=r, sleep=naps.append, clock=lambda: 1794300000), rs.Unavailable)
t('with the day\'s cap spent the sweep refuses before any read', bool(e) and 'cap of 4 reads' in str(e), e)
rows, st = rs.sweep('facebook', PLAN, log=log, runner=r, sleep=naps.append, clock=lambda: 1794300000 + 86400)
t('and the cap is the day\'s: tomorrow it reads again', st['reads'] == 3, st)

fresh(); r, calls = mk({('instagram', 'posts'): lambda u: {'ok': True, 'items': [IG_ITEM]} if u == 'harbour.watch' else {'ok': False, 'error': {'code': 'NEED_LOGIN', 'hint': 'log in'}}}, calls=[])
e = raises(lambda: rs.sweep('instagram', PLAN, log=log, runner=r, sleep=lambda s: None, clock=lambda: 1794300000), rs.Unavailable)
t('a login wall in the middle of a sweep stops it as unavailable, not as a quiet day', bool(e) and e.why == 'needs_login' and [c[:3] for c in calls if c[0] == 'instagram'] == [['instagram', 'posts', 'harbour.watch'], ['instagram', 'posts', 'baykeepers']], (e, calls))

fresh(); r, calls = mk({('facebook', 'search'): [{'ok': True, 'items': [FB_ITEM]}, {'ok': False, 'error': {'code': 'PLATFORM_BLOCKED', 'message': 'checkpoint required sessionid=abcdef1234567890abcdef'}}]}, calls=[])
e = raises(lambda: rs.sweep('facebook', PLAN, log=log, runner=r, sleep=lambda s: None, clock=lambda: 1794300000), rs.Challenge)
t('a verification stops the sweep at once: no third read', bool(e) and len([c for c in calls if c[0] == 'facebook']) == 2, calls)
t('and says a person clears it, without the session in the message', bool(e) and '--login facebook' in str(e) and 'abcdef1234567890' not in str(e), e)
until, why = rs.paused('facebook', 1794300000 + 3600)
t('the platform is paused for 24 hours and not offered meanwhile', until == 1794300000 + 86400 and 'verification' in why and not rs.status('facebook', runner=mk()[0], now=1794300000 + 3600)['usable'])
e = raises(lambda: rs.assert_ready('facebook', runner=mk()[0], now=1794300000 + 3600), rs.Unavailable)
t('a job during the pause is refused with when it lifts', bool(e) and 'paused on this machine until' in str(e), e)
t('after 24 hours it is offered again', rs.status('facebook', runner=mk()[0], now=1794300000 + 86401)['usable'])

fresh(); r, calls = mk({('youtube', 'search'): {'ok': False, 'error': {'code': 'RATE_LIMITED', 'retry_after_seconds': 300}}}, calls=[])
rows, st = rs.sweep('youtube', PLAN, log=log, runner=r, sleep=lambda s: None, clock=lambda: 1794300000)
t('asked to slow down, the run ends there', st['reads'] == 1 and rows == [] and 'slow down' in st['errors'][0], st)

fresh(); r, calls = mk({('facebook', 'search'): (0, '<html>Log in to Facebook</html>', '')}, calls=[])
e = raises(lambda: rs.sweep('facebook', PLAN, log=log, runner=r, sleep=lambda s: None, clock=lambda: 1794300000), rs.ParseFailed)
t('three answers that are not what agent-reach promises pause the platform and say so', bool(e) and 'paused on this machine for 24 hours' in str(e) and rs.paused('facebook', 1794300001)[0] > 0 and len([c for c in calls if c[0] == 'facebook']) == 3, (e, len(calls)))
fresh(); r, calls = mk({('facebook', 'search'): {'ok': True, 'items': [{'url': 'https://www.facebook.com/harbourwatch', 'text': 'changed shape'}]}}, calls=[])
e = raises(lambda: rs.sweep('facebook', PLAN, log=log, runner=r, sleep=lambda s: None, clock=lambda: 1794300000), rs.ParseFailed)
t('items that come back with nothing readable are a failure too, never an empty success', bool(e) and 'nothing readable' in str(e), e)
fresh(); r, calls = mk({('facebook', 'search'): [(0, 'garbage', ''), {'ok': True, 'items': [FB_ITEM]}, (0, 'garbage', ''), {'ok': True, 'items': [FB_ITEM]}]}, calls=[])
rows, st = rs.sweep('facebook', dict(PLAN, queries=['a b', 'c d', 'e f', 'g h']), log=log, runner=r, sleep=lambda s: None, clock=lambda: 1794300000)
t('one unreadable answer between good ones is counted and the sweep carries on', len(rows) == 1 and len(st['errors']) == 2 and not rs.paused('facebook', 1794300001)[0], st)

# ---- nothing shaped like a session is logged ----
s = rs.scrub('GET ok sessionid=1234567890abcdef; c_user: 100012345678 Authorization: Bearer abcdefghijklmnop and ' + 'A' * 60)
t('a cookie, a token and a long opaque string are struck out of a log line', not any(x in s for x in ('1234567890abcdef', '100012345678', 'abcdefghijklmnop', 'A' * 48)) and 'sessionid' in s and 'GET ok' in s, s)
fresh(); lines = []; r, _ = mk({('facebook', 'search'): (0, 'Set-Cookie: xs=77aabbccddeeff00112233; path=/', '')})
raises(lambda: rs.sweep('facebook', PLAN, log=log, runner=r, sleep=lambda s: None, clock=lambda: 1794300000), rs.ParseFailed)
t('and the same holds for what a sweep logs', lines and not any('77aabbccddeeff00112233' in x for _, x in lines), lines[:2])

# ---- the job: plan in, posts out as layer 2 ----
fresh(); sent = []
def http(url, key, body=None, timeout=60):
    sent.append((url.split('workers.test')[1], body))
    if '/reddit/issues' in url: return {'issues': [{'id': 'gas', 'ns': 'aep'}, {'id': 'gastax', 'ns': 'aep'}, {'id': 'ftc', 'ns': 'mca'}, {'id': 'firearms', 'ns': 'guns'}]}
    if '/den/plan' in url:
        ns = url.split('ns=')[1].split('&')[0]
        return dict(PLAN, ns=ns) if ns == 'aep' else {'ok': True, 'ns': ns, 'queries': [] if ns == 'guns' else ['fuel tax credit'], 'plan': {'instagram': {'accounts': []}, 'facebook': {}}}
    return {'ok': True, 'kept': 1, 'inserted': 1, 'updated': 0, 'skipped': {'off_topic': 0, 'foreign': 2, 'bad_url': 0}}
r, calls = mk({('facebook', 'search'): {'ok': True, 'items': [FB_ITEM]}, ('instagram', 'posts'): {'ok': True, 'items': [IG_ITEM]}}, calls=[])
res = rs.collect('facebook', 'https://x.workers.test', 'k', {}, log, http=http, runner=r, sleep=lambda s: None, clock=lambda: 1794300000)
ing = [b for u, b in sent if u == '/signals/ingest']
t('every desk with something to read is read, each handed to /signals/ingest as layer 2', res['ok'] and res['desks'] == 2 and [(b['ns'], b['layer'], b['via'], len(b['rows'])) for b in ing] == [('aep', 2, 'reach', 1), ('mca', 2, 'reach', 1)], (res, [(b['ns'], len(b['rows'])) for b in ing]))
t('a desk with nothing to read costs no read', not any(u.startswith('/signals/ingest') and b['ns'] == 'guns' for u, b in sent) and res['reads'] == 4, res['reads'])
t('the result says what was read, kept and refused', '4 reads for 2 desks' in res['summary'] and '4 not Australian' in res['summary'] and res['threadRows'] == 2, res['summary'])
t('no name left the machine', 'Jo Citizen' not in json.dumps(ing) and 'author' not in json.dumps(ing))
r, calls = mk({('instagram', 'posts'): lambda u: {'ok': True, 'items': [dict(IG_ITEM, url='https://www.instagram.com/p/POST' + ('AAAAA1' if u == 'harbour.watch' else 'BBBBB2') + '/')]}}, calls=[])
sent.clear(); res = rs.collect('instagram', 'https://x.workers.test', 'k', {'ns': 'aep'}, log, http=http, runner=r, sleep=lambda s: None, clock=lambda: 1794300000)
ig_sent = [b for u, b in sent if u == '/signals/ingest']
t('Instagram reads the registered accounts of the one desk asked for, each post tied to its register row', res['desks'] == 1 and sent[0][0] == '/den/plan?ns=aep&platform=instagram' and len(ig_sent) == 1 and sorted(x.get('watch') for x in ig_sent[0]['rows']) == ['w2', 'w5'], (res, sent[:1], ig_sent))
t('and never asks for every client when one was named', not any(u.startswith('/reddit/issues') for u, _ in sent))
rf, _ = mk({('facebook', 'search'): {'ok': True, 'items': [FB_ITEM]}})
e = raises(lambda: rs.collect('facebook', 'https://x.workers.test', 'k', {'ns': 'aep'}, log, http=lambda url, key, body=None, timeout=60: (dict(PLAN) if '/den/plan' in url else {'ok': False, 'error': 'read_only', 'detail': 'A read key cannot collect.'}), runner=rf, sleep=lambda s: None, clock=lambda: 1794300000), RuntimeError)
t('a refusal from the worker fails the job and says why', bool(e) and 'read_only' in str(e), e)

# ---- signing in ----
fresh(); said = []; ran = []
t('signing in to Facebook with a profile that administers client assets stops', rs.login('facebook', ask=lambda q: 'yes', out=said.append, call=lambda c: ran.append(c) or 0) is False and ran == [] and 'administers nothing' in said[-1], said[-1])
t('the warning names the terms, the account risk and the client-admin rule', 'against facebook\'s terms' in said[0] and 'NEVER use a profile that administers' in said[0] and 'never sees the password' in said[0])
answers = iter(['no', 'instagram'])
t('the wrong platform name stops it too', rs.login('facebook', ask=lambda q: next(answers), out=said.append, call=lambda c: ran.append(c) or 0) is False and ran == [])
answers = iter(['no', 'facebook'])
ok = rs.login('facebook', ask=lambda q: next(answers), out=said.append, call=lambda c: ran.append(c) or 0, who='anne')
t('the right answers hand over to agent-reach\'s own sign-in window, and the switch-on is recorded', ok and ran == [['agent-reach', 'login', 'facebook']] and rs.state('facebook')['switched_on']['by'] == 'anne')
answers = iter(['youtube'])
t('YouTube needs no profile question', rs.login('youtube', ask=lambda q: next(answers), out=said.append, call=lambda c: 0) is True)
answers = iter(['no', 'instagram'])
t('a sign-in that does not finish switches nothing on', rs.login('instagram', ask=lambda q: next(answers), out=said.append, call=lambda c: 1) is False and 'switched_on' not in rs.state('instagram'))

# ---- the agent: what it offers, and how a stop is reported ----
agent = load('reach_agent', 'reach-agent.py')
fresh(); real = agent.rs.status
agent.rs.status = lambda c, runner=None, now=None: {'usable': c != 'instagram', 'channel': c}
agent.rs.offered = lambda runner=None: [agent.rs.CHANNELS[c]['source'] for c in agent.rs.CHANNELS if agent.rs.status(c)['usable']]
off = agent.collectors()
t('the agent offers a social channel only when it is usable on this machine', 'facebook' in off and 'ytsearch' in off and 'instagram' not in off, off)
t('and has a job for each', all(k in agent.JOBS for k in ('facebook', 'instagram', 'ytsearch')))
posted = []
agent.rr.http_json = lambda url, key, body=None, timeout=30: posted.append((url.rsplit('/', 2)[-2] + '/' + url.rsplit('/', 1)[-1], body)) or {'ok': True}
def boom(exc):
    def f(worker, key, params, log): raise exc
    return f
for name, exc, code in (('a verification', agent.rs.Challenge('facebook', 'checkpoint xs=aabbccddeeff001122'), 'facebook_challenge'), ('not signed in', agent.rs.Unavailable('instagram', 'needs_login'), 'instagram_unavailable'),
                        ('an unreadable page', agent.rs.ParseFailed('youtube', 'the shape changed'), 'youtube_parse_failed')):
    posted.clear(); agent.JOBS['facebook'] = boom(exc)
    res = agent.run_job('https://x.workers.test', 'k', {'id': 'j1', 'source': 'facebook', 'params': {}}, echo=False)
    done = [b for u, b in posted if u == 'bridge/done']
    t('%s is reported to the worker as %s, failed, in words' % (name, code), res['error'] == code and len(done) == 1 and done[0]['ok'] is False and done[0]['result']['error'] == code and len(done[0]['result']['detail']) > 20, (res, done))
    t('  and no session string is in the report or the log', 'aabbccddeeff001122' not in json.dumps(posted), json.dumps(posted)[:300])
agent.rs.status = real

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
