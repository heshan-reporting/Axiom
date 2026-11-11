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
rs._which = lambda b: None            # no native tool unless a case says so: the Mac this runs on may have opencli

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
t('a broken channel and one agent-reach does not list are not offered', rs.offered(runner=r2) == [] and rs.status('youtube', runner=r2)['status'] == 'unreadable')
r3, _ = mk(doctor='facebook      ready\ninstagram     needs_login\nyoutube       cooldown\n')
t('doctor\'s plain text is read when it is not JSON', rs.status('facebook', runner=r3)['usable'] and rs.status('instagram', runner=r3)['status'] == 'needs_login' and 'cooldown' in rs.status('youtube', runner=r3)['why'])
rs._write('reach.json', {'facebook': {'enabled': False}, 'instagram': {'pace': 1, 'per_day': 5}})
t('a platform switched off on this machine is not offered', not rs.status('facebook', runner=r)['usable'] and 'switched off' in rs.status('facebook', runner=r)['why'])
t('the pace cannot be set under ten seconds', rs.settings('instagram')['pace'] == 10.0 and rs.settings('instagram')['per_day'] == 5)
real_which = rs.shutil.which; rs.shutil.which = lambda b: None
e = raises(lambda: rs.assert_ready('facebook'), rs.Unavailable)
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
t('YouTube needs no profile question', rs.login('youtube', ask=lambda q: next(answers), out=said.append, call=lambda c: 0, runner=mk()[0]) is True)
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

# ---- subscriber news: one article through a publisher's signed-in profile ----
agent.PROFILES = os.path.join(tempfile.mkdtemp(), 'profiles')
t('with no publisher signed in, the agent does not offer the subscriber read', agent.gated_profiles() == [] and 'gated' not in agent.collectors())
os.makedirs(agent.profile_dir('afr')); agent.have_playwright = lambda: True
t('with a publisher\'s profile on the machine it does', agent.gated_profiles() == ['afr'] and 'gated' in agent.collectors() and 'gated' in agent.JOBS)
LONGP = '<p>' + ('The Senate will vote on a gas export tax this week after the crossbench secured a debate on the floor. ' * 3) + '</p>'
PAGE = '<html><head><title>Senate to vote</title></head><body><article>' + LONGP * 5 + '</article></body></html>'
WALL = '<html><body><article><p>Subscribe to read the full story. Already a subscriber? Log in.</p></article></body></html>'
saved = []
agent.rr.http_json = lambda url, key, body=None, timeout=30: saved.append((url.rsplit('/', 2)[-2] + '/' + url.rsplit('/', 1)[-1], body)) or {'ok': True, 'id': 7}
glog = []
res = agent.job_gated('https://x.workers.test', 'k', {'id': 7, 'url': 'https://www.afr.com/politics/a', 'profile': 'afr'}, lambda k, x: glog.append((k, x)), render=lambda url, src, **kw: (PAGE, url))
t('an article read through the profile is handed to the worker as subscriber text', res['ok'] and res['method'] == 'subscriber' and saved[-1][0] == 'fulltext/save' and saved[-1][1]['gated'] is True and saved[-1][1]['source'] == 'afr' and len(saved[-1][1]['text']) > 600, (res, saved[-1][1].keys()))
t('and the log names the profile, never a cookie', any('profile news-afr' in x for _, x in glog))
saved.clear(); agent.rr.http_json = lambda url, key, body=None, timeout=30: saved.append(body) or {'ok': False, 'error': 'subscription_wall', 'detail': 'still showed its paywall'}
res = agent.job_gated('https://x.workers.test', 'k', {'id': 7, 'url': 'https://www.afr.com/politics/a', 'profile': 'afr'}, lambda k, x: None, render=lambda url, src, **kw: (WALL, url))
t('a page that still shows its paywall is reported as that, with no text sent', res['ok'] is False and res['error'] == 'subscription_wall' and saved[0].get('wall') is True and 'text' not in saved[0], (res, saved))
e = raises(lambda: agent.job_gated('https://x.workers.test', 'k', {'id': 7, 'url': 'https://www.theaustralian.com.au/a', 'profile': 'theaustralian'}, lambda k, x: None, render=lambda *a, **k: (PAGE, '')), RuntimeError)
t('a publisher nobody signed in to on this machine is refused, with the command', bool(e) and '--login news:theaustralian' in str(e), e)
agent.rr.http_json = lambda url, key, body=None, timeout=30: {'ok': False, 'error': 'source_not_cleared', 'detail': 'not cleared for the subscriber read'}
res = agent.job_gated('https://x.workers.test', 'k', {'id': 7, 'url': 'https://www.afr.com/politics/a', 'profile': 'afr'}, lambda k, x: None, render=lambda url, src, **kw: (PAGE, url))
t('the worker\'s refusal of an uncleared source fails the job in its words', res['ok'] is False and res['error'] == 'source_not_cleared' and 'not cleared' in res['detail'], res)
said = []; opened = []
t('signing in to a publisher stops unless it is the agency\'s own subscription', agent.login_news('afr', 'https://www.afr.com/', ask=lambda q: 'no', out=said.append, render=lambda *a, **k: opened.append(a)) is False and opened == [])
flat = ' '.join(said[0].split())
t('the warning names the rules', 'Never a personal, borrowed or shared login' in flat and 'does not download the paper' in flat and 'never sees the password' in flat and 'no paywall-bypass' in flat, flat[:200])
t('with yes, a visible window opens at the publisher and waits for the person', agent.login_news('afr', 'https://www.afr.com/', ask=lambda q: 'yes', out=said.append, render=lambda url, src, **kw: opened.append((url, src, kw)) or ('', url)) is True and opened[0][0] == 'https://www.afr.com/' and opened[0][2] == {'headless': False, 'wait_closed': True}, opened)


# ---- agent-reach as it really answers (the owner's Mac, v1.5.0, 11 November 2026; tests/fixtures/den/) ----------------
# Everything above uses a stand-in that answers as the documentation was read. These use the real output.
FX = os.path.join(HERE, 'fixtures', 'den')
REAL_DOCTOR = open(os.path.join(FX, 'agent-reach-doctor-1.5.0.txt'), encoding='utf-8').read()
REAL_HELP = open(os.path.join(FX, 'agent-reach-help-1.5.0.txt'), encoding='utf-8').read()
def real(doctor=REAL_DOCTOR, helptext=REAL_HELP, calls=None):
    calls = calls if calls is not None else []
    def runner(cmd, timeout):
        calls.append(cmd[1:])
        if cmd[1:] == ['doctor']: return (0, doctor, '')
        if cmd[1:] == ['--help']: return (0, helptext, '')
        if cmd[1] == 'doctor': return (2, '', 'usage: agent-reach ...\nagent-reach: error: unrecognized arguments: ' + ' '.join(cmd[2:]))
        return (2, '', "usage: agent-reach ...\nagent-reach: error: argument command: invalid choice: '%s'" % cmd[1])
    return runner, calls
fresh()
marks = rs.doctor_marks(REAL_DOCTOR)
t('the real doctor text is read: YouTube is marked not installed, with the doctor\'s own reason', marks.get('youtube', {}).get('mark') == 'not_installed' and 'yt-dlp' in marks['youtube']['detail'], marks.get('youtube'))
t('Facebook and Instagram are read from the list of channels still to unlock', marks.get('facebook', {}).get('mark') == 'locked' and marks.get('instagram', {}).get('mark') == 'locked', marks)
t('a channel marked usable or needing sign-in is read as that', rs.doctor_marks('  ✅ YouTube 视频和字幕 — ok\n  [!]  Facebook 帖子 — login')['youtube']['mark'] == 'ok' and rs.doctor_marks('  [!]  Facebook 帖子 — login')['facebook']['mark'] == 'needs_config')
t('the commands this agent-reach has are read from its help', rs.commands(real()[0]) == {'setup', 'install', 'configure', 'doctor', 'uninstall', 'skill', 'format', 'transcribe', 'check-update', 'watch', 'version'}, rs.commands(real()[0]))
r, calls = real()
for c in ('facebook', 'instagram'):
    st = rs.status(c, runner=r)
    t('%s on the real answers: not usable, and the reason is named, not "unknown"' % c, st['usable'] is False and st['status'] == 'no_command' and 'unknown' not in st['why'] and ('no `%s` command' % c) in st['why'], st)
    t('  and it does not send anyone to a command that does not exist', 'doctor --text' not in st['why'] and 'agent-reach add' not in st['why'] and 'agent-reach check' not in st['why'], st['why'])
t('the doctor is asked the way this version accepts', ['doctor'] in calls and not any(c[:1] == ['doctor'] and len(c) > 1 for c in calls), calls)
t('nothing is offered to the worker on the real answers', rs.offered(runner=r) == [], rs.offered(runner=r))
e = raises(lambda: rs.assert_ready('facebook', runner=r), rs.Unavailable)
t('a sweep stops before it starts, as facebook_unavailable with that reason', bool(e) and e.why == 'no_command', e)
# a doctor answer in neither shape is still a named failure, never usable
r2, _ = real(doctor='something else entirely\n', helptext='no usage here\n')
st = rs.status('facebook', runner=r2)
t('a doctor answer that cannot be read is "unreadable", never usable', st['usable'] is False and st['status'] == 'unreadable' and 'could not be read' in st['why'], st)
# usable on the real shape needs both: the doctor's tick and a command to run
r3, _ = real(doctor='  \u2705 Facebook \u5e16\u5b50 \u2014 ok\n')
t('a tick from the doctor is not enough without a command to search with', rs.status('facebook', runner=r3)['usable'] is False and rs.status('facebook', runner=r3)['status'] == 'no_command')
r4, _ = real(doctor='  \u2705 Facebook \u5e16\u5b50 \u2014 ok\n', helptext=REAL_HELP.replace('{setup,', '{facebook,setup,'))
t('a tick and a command together are usable', rs.status('facebook', runner=r4)['usable'] is True, rs.status('facebook', runner=r4))
said = []; ran = []
t('signing in is refused in words when this agent-reach has no login command, before any question', rs.login('facebook', ask=lambda q: said.append('ASKED') or 'no', out=said.append, call=lambda c: ran.append(c) or 0, runner=r) is False and ran == [] and 'ASKED' not in said and 'no `login` command' in said[-1], said)


# ---- YouTube keyword search through yt-dlp (the owner's decision, 11 November 2026) ----------------------------------
# yt-dlp is a stand-in that answers one JSON object a line, as `--flat-playlist --dump-json` is recalled to. NOT proven
# on a real machine: the first dry run on the Mac is the test.
YT_LINES = [{'_type': 'url', 'id': 'dQw4w9WgXcQ', 'title': 'Why a gas export tax would work', 'description': 'An explainer from Canberra.', 'view_count': 34000, 'channel': 'Sam Private', 'uploader': 'Sam Private', 'channel_id': 'UCxxxxxxxxxxxxxxxxxxxxxx', 'uploader_id': '@samprivate', 'timestamp': 1794276000},
            {'_type': 'url', 'id': 'UCxxxxxxxxxxxxxxxxxxxxxx', 'title': 'A channel, not a video'},
            {'_type': 'url', 'id': 'aaaaaaaaaaa', 'title': 'Scott Reef: what NOPSEMA decided', 'description': None, 'view_count': None, 'upload_date': '20261109'}]
def ytd(answer=None, version='2026.10.30', calls=None, help_text=REAL_HELP):
    calls = calls if calls is not None else []
    def runner(cmd, timeout):
        calls.append(cmd)
        if cmd[0] == 'yt-dlp':
            if cmd[1] == '--version': return (0, version + '\n', '') if version else (127, '', 'not found')
            a = answer(cmd[1]) if callable(answer) else answer
            return a if isinstance(a, tuple) else (0, '\n'.join(json.dumps(x) for x in (a if a is not None else YT_LINES)) + '\n', '')
        if cmd[1:] == ['--help']: return (0, help_text, '')
        if cmd[1:] == ['doctor']: return (0, REAL_DOCTOR, '')
        return (2, '', 'invalid choice')
    return runner, calls
fresh(); r, calls = ytd()
t('with an agent-reach that has no youtube command, YouTube reads through yt-dlp', rs.backend('youtube', r) == 'ytdlp' and rs.backend('facebook', r) == 'agent-reach')
st = rs.status('youtube', runner=r)
t('installed is not switched on: a person does that once, and the line says how', st['usable'] is False and st['status'] == 'not_switched_on' and '--login youtube' in st['why'] and st.get('backend') == 'yt-dlp', st)
t('  so nothing is offered yet', rs.offered(runner=r) == [])
r0, _ = ytd(version='')
st = rs.status('youtube', runner=r0)
t('without yt-dlp it says so, with the install command for the collector\'s environment', st['status'] == 'ytdlp_not_installed' and 'yt-dlp[default]' in st['why'] and st['usable'] is False, st)
said = []
t('switching on without yt-dlp stops before the question', rs.login('youtube', ask=lambda q: said.append('ASKED') or 'youtube', out=said.append, runner=r0) is False and 'ASKED' not in said)
said = []
t('the wrong word switches nothing on', rs.login('youtube', ask=lambda q: 'yes', out=said.append, runner=r) is False and 'switched_on' not in rs.state('youtube'))
ok = rs.login('youtube', ask=lambda q: 'youtube', out=said.append, runner=r, who='anne')
t('typing the platform\'s name switches it on, recorded with who and the backend, and nothing is signed in to', ok and rs.state('youtube')['switched_on']['by'] == 'anne' and rs.state('youtube')['switched_on']['backend'] == 'yt-dlp' and any('no sign-in' in x for x in said) and not any(c[0] != 'yt-dlp' and c[1:2] == ['login'] for c in calls), said)
st = rs.status('youtube', runner=r)
t('then it is usable and offered as ytsearch', st['usable'] is True and st['status'] == 'ready' and rs.offered(runner=r) == ['ytsearch'], st)
items = rs.run_ytsearch('gas export tax', 10, runner=r)
t('a search is one yt-dlp call in the public form, with no cookies and no config', calls[-1][:2] == ['yt-dlp', 'ytsearch10:gas export tax'] and '--flat-playlist' in calls[-1] and '--dump-json' in calls[-1] and '--ignore-config' in calls[-1] and not any('cookie' in str(x) for x in calls[-1]), calls[-1])
t('videos come back with an address, words, the date and the count; a channel in the results is not a video', [i['url'] for i in items] == ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=aaaaaaaaaaa'] and items[0]['raw'] == {'view_count': 34000} and items[1]['published_at'] == '2026-11-09T00:00:00Z', items)
t('the channel and uploader are never carried', 'Sam Private' not in json.dumps(items) and 'samprivate' not in json.dumps(items) and 'UCxxxx' not in json.dumps(items))
PLAN_YT = {'ok': True, 'ns': 'aep', 'queries': ['gas export tax', 'scott reef'], 'plan': {'youtube': {'accounts': []}}}
slept = []; ylog = []
rows, stt = rs.sweep('youtube', PLAN_YT, log=lambda k, x: ylog.append((k, x)), runner=r, sleep=slept.append, clock=lambda: 1794300000)
t('a sweep files rows in the ingest shape and names no one', len(rows) == 2 and all(set(x) <= {'platform', 'url', 'text', 'eng', 'eng_at', 'ts', 'q'} for x in rows) and rows[0]['eng'].get('views') == 34000 and 'Sam Private' not in json.dumps(rows), rows)
t('the pace floor holds between searches', slept == [10.0] or (len(slept) == 1 and slept[0] >= 10), slept)
t('the console shows the yt-dlp command, not an agent-reach one', any(k == 'cmd' and x.startswith('yt-dlp "ytsearch') for k, x in ylog) and not any('agent-reach youtube' in x for _, x in ylog), ylog[:2])
fresh(); rs.login('youtube', ask=lambda q: 'youtube', out=lambda x: None, runner=r)
rb, _ = ytd(answer=(1, '', "ERROR: [youtube] Sign in to confirm you're not a bot. Use --cookies-from-browser"))
e = raises(lambda: rs.sweep('youtube', PLAN_YT, log=lambda k, x: None, runner=rb, sleep=lambda s: None, clock=lambda: 1794300000), rs.Challenge)
t('a bot check stops the sweep at once and pauses YouTube for 24 hours; no cookies are tried', bool(e) and rs.paused('youtube', 1794300000)[0] > 1794300000 and rs.status('youtube', runner=r, now=1794300001)['usable'] is False, e)
fresh(); rs.login('youtube', ask=lambda q: 'youtube', out=lambda x: None, runner=r)
rj, _ = ytd(answer=(0, 'WARNING: something\n<html>not json</html>\n', ''))
rows, stt = rs.sweep('youtube', {'ok': True, 'queries': ['gas export tax'], 'plan': {}}, log=lambda k, x: None, runner=rj, sleep=lambda s: None, clock=lambda: 1794300000)
t('an answer that is not JSON is a named failure, never an empty success', rows == [] and len(stt['errors']) == 1 and 'not JSON' in stt['errors'][0], stt)
rl, _ = ytd(answer=(1, '', 'ERROR: HTTP Error 429: Too Many Requests'))
rows, stt = rs.sweep('youtube', PLAN_YT, log=lambda k, x: None, runner=rl, sleep=lambda s: None, clock=lambda: 1794300000)
t('a 429 stops the run after one read', stt['reads'] == 1 and 'slow down' in stt['errors'][0], stt)
re_, _ = ytd(answer=(0, '', ''))
rows, stt = rs.sweep('youtube', {'ok': True, 'queries': ['a term nobody uses'], 'plan': {}}, log=lambda k, x: None, runner=re_, sleep=lambda s: None, clock=lambda: 1794300000)
t('a search with no results is a quiet answer, not an error', rows == [] and stt['errors'] == [] and stt['reads'] == 1, stt)
t('Facebook and Instagram are unchanged: still no_command, nothing offered for them', rs.status('facebook', runner=r)['status'] == 'no_command' and rs.status('instagram', runner=r)['status'] == 'no_command')

# ---- Facebook and Instagram through opencli, the tool agent-reach installs for them (stand-ins: no real sweep answer has been seen) ----
print('native backends')
YT_LINES = '\n'.join(json.dumps(v) for v in [
    {'id': 'dQw4w9WgXcQ', 'title': 'Why a gas export tax would work', 'description': 'An explainer on the gas export tax in Australia.', 'view_count': 34000, 'timestamp': 1794276000, 'channel': 'Sam Private', 'uploader': 'Sam Private', 'uploader_id': '@samprivate'},
    {'id': 'PLx', 'title': 'a playlist'}]) + '\n'
OC_FB = [{'index': 1, 'title': 'Jo Citizen', 'text': 'Sign the gas export tax petition, Canberra', 'url': 'https://www.facebook.com/108000000000001/posts/990000000000002'},
         {'index': 2, 'title': 'Harbour Watch', 'text': 'Community organisation', 'url': 'https://www.facebook.com/harbourwatch'}]
OC_IG = [{'index': 1, 'caption': 'A gas export tax would fund hospitals', 'likes': 900, 'comments': 40, 'type': 'reel', 'date': '2026-11-10T02:00:00Z', 'url': 'https://www.instagram.com/reel/DAbCdEfGhI3/'}]
def nat(answers=None, have=('opencli', 'yt-dlp'), who=True, calls=None, ar=True):
    """agent-reach as it really answers (no channel command), plus stand-ins for yt-dlp and opencli."""
    answers = answers or {}; calls = calls if calls is not None else []
    rs._which = lambda b: ('/usr/local/bin/' + b) if b in have else None
    base, _ = real()
    def runner(cmd, timeout):
        if cmd[0] == 'agent-reach': return base(cmd, timeout)
        calls.append(cmd)
        if cmd[0] == 'yt-dlp':
            a = answers.get('yt', (0, YT_LINES, ''))
        elif cmd[2] == 'whoami':
            a = answers.get((cmd[1], 'whoami'), (0, json.dumps([{'username': 'agency.monitor', 'name': 'A Person'}]), '') if who else (1, '', 'Error: not logged in to %s' % cmd[1]))
        else:
            a = answers.get((cmd[1], cmd[2]), (0, json.dumps(OC_FB if cmd[1] == 'facebook' else OC_IG), ''))
        if isinstance(a, list): a = a.pop(0) if len(a) > 1 else a[0]
        return a
    return runner, calls
def on(*chs):
    for c in chs: rs.save_state(c, dict(rs.state(c), switched_on={'at': 1, 'by': 'test'}))

fresh(); r, calls = nat()
st = rs.status('facebook', runner=r)
t('opencli on the machine is not enough: Facebook waits for a person to switch it on', st['usable'] is False and st['status'] == 'needs_login' and '--login facebook' in st['why'], st)
t('nothing is offered until then', rs.offered(runner=r) == [], rs.offered(runner=r))
on('facebook', 'instagram')
t('once switched on, Facebook and Instagram are offered', rs.offered(runner=r) == ['facebook', 'instagram'], rs.offered(runner=r))
r0, _ = nat(have=())
st = rs.status('facebook', runner=r0)
t('without opencli the answer is still no_command, and it names the tool to install', st['status'] == 'no_command' and 'opencli' in (st.get('native_hint') or ''), st)

# the commands themselves
t('the Facebook command is opencli\'s search, as JSON, in a background window', rs.native_cmd('facebook', 'search', 'scott reef', 10) == ['opencli', 'facebook', 'search', 'scott reef', '--limit', '10', '-f', 'json', '--window', 'background'])
t('the Instagram command reads one registered account\'s posts', rs.native_cmd('instagram', 'posts', 'harbour.watch', 10)[:4] == ['opencli', 'instagram', 'user', 'harbour.watch'])
for bad in (('facebook', 'like'), ('facebook', 'comment'), ('facebook', 'add-friend'), ('facebook', 'join-group'), ('instagram', 'follow'), ('instagram', 'post'), ('instagram', 'search'), ('facebook', 'login')):
    t('a command that writes is refused before it runs: %s %s' % bad, isinstance(raises(lambda: rs.native_cmd(bad[0], bad[1], 'x', 1), RuntimeError), RuntimeError))

# rows
fresh(); r, calls = nat(); on('facebook', 'instagram')
items = rs.run_native('facebook', 'search', 'gas export tax', 10, runner=r)
t('a Facebook search keeps posts only: a page or a person in the results is dropped', len(items) == 1 and '990000000000002' in items[0]['url'], items)
t('  and the result\'s title, which can be a person\'s name, is never read', 'Jo Citizen' not in json.dumps(items) and 'title' not in items[0])
items = rs.run_native('instagram', 'posts', 'harbour.watch', 10, runner=r)
t('an Instagram post carries its caption, counts, date and address', len(items) == 1 and items[0]['likes'] == 900 and items[0]['comments'] == 40 and 'DAbCdEfGhI3' in items[0]['url'], items)
r1, _ = nat({('instagram', 'user'): (0, json.dumps([{'index': 1, 'caption': 'x', 'likes': 1, 'comments': 0, 'type': 'post', 'date': '2026-11-10', 'shortcode': 'DAbCdEfGhI3'}]), '')})
t('a shortcode stands for the address when that is what opencli gives', 'instagram.com/p/DAbCdEfGhI3' in rs.run_native('instagram', 'posts', 'a', 5, runner=r1)[0]['url'])
r1, _ = nat({('instagram', 'user'): (0, json.dumps([{'index': 1, 'caption': 'x', 'likes': 1, 'comments': 0, 'type': 'post', 'date': '2026-11-10'}]), '')})
e = raises(lambda: rs.run_native('instagram', 'posts', 'a', 5, runner=r1), rs.ParseFailed)
t('posts with no address are a named failure, never an empty success', bool(e) and 'instagram_no_address' in str(e) and 'caption' in str(e), e)
r1, _ = nat({('facebook', 'search'): (0, 'opencli v1.8.6 - update available\n' + json.dumps(OC_FB) + '\n', '')})
t('a banner before the JSON does not hide it', len(rs.run_native('facebook', 'search', 'q', 5, runner=r1)) == 1)
r1, _ = nat({('facebook', 'search'): (0, json.dumps([dict(OC_FB[0], text='Police checkpoint protest: please sign in at the gate, 429 people came')]), '')})
t('a post that says "checkpoint" or "sign in" is a post, not a refusal', len(rs.run_native('facebook', 'search', 'q', 5, runner=r1)) == 1)
r1, _ = nat({('facebook', 'search'): (0, json.dumps([]), '')})
t('no results is an empty answer, not a failure', rs.run_native('facebook', 'search', 'q', 5, runner=r1) == [])

# refusals
r1, _ = nat({('facebook', 'search'): (1, '', 'Error: Facebook checkpoint: verify it\'s you')})
t('a verification is a Challenge', isinstance(raises(lambda: rs.run_native('facebook', 'search', 'q', 5, runner=r1), rs.Challenge), rs.Challenge))
r1, _ = nat({('instagram', 'user'): (1, '', 'Error: not logged in')})
e = raises(lambda: rs.run_native('instagram', 'posts', 'a', 5, runner=r1), rs.Unavailable)
t('signed out is needs_login', bool(e) and e.why == 'needs_login', e)
r1, _ = nat({('facebook', 'search'): (1, '', 'HTTP 429 Too Many Requests')})
t('a slow-down is RateLimited', isinstance(raises(lambda: rs.run_native('facebook', 'search', 'q', 5, runner=r1), rs.RateLimited), rs.RateLimited))
r1, _ = nat({('facebook', 'search'): (1, '', 'Browser extension not connected')})
e = raises(lambda: rs.run_native('facebook', 'search', 'q', 5, runner=r1), rs.Unavailable)
t('a disconnected browser bridge is said, with opencli doctor', bool(e) and e.why == 'bridge' and 'opencli doctor' in str(e), e)
r1, _ = nat({('facebook', 'search'): (0, '<html>hello</html>', '')})
t('an answer that is not JSON is ParseFailed', isinstance(raises(lambda: rs.run_native('facebook', 'search', 'q', 5, runner=r1), rs.ParseFailed), rs.ParseFailed))

# the sweep and the job
fresh(); r, calls = nat(); on('facebook', 'instagram'); lines = []
calls.clear()
rows, stats = rs.sweep('instagram', PLAN, log=log, runner=r, sleep=lambda s: None, clock=lambda: 1794300000)
t('an Instagram sweep reads the registered accounts and nothing else', [c[1:4] for c in calls] == [['instagram', 'user', 'harbour.watch'], ['instagram', 'user', 'baykeepers']] and len(rows) >= 1, calls)
fresh(); r, calls = nat({('facebook', 'search'): (1, '', 'checkpoint required')}); on('facebook')
e = raises(lambda: rs.sweep('facebook', PLAN, log=log, runner=r, sleep=lambda s: None, clock=lambda: 1794300000), rs.Challenge)
t('a verification stops the sweep at the first read and pauses the platform', bool(e) and len(calls) == 1 and rs.paused('facebook', 1794300000)[0] > 1794300000, (e, calls))
posted = []
def http(url, key, body=None):
    if '/den/desks' in url: return {'ok': True, 'desks': [{'ns': 'aep'}]}
    if '/den/plan' in url: return PLAN
    posted.append(body); return {'ok': True, 'kept': len(body['rows']), 'inserted': len(body['rows']), 'updated': 0, 'skipped': {}}
fresh(); r, calls = nat(who=False); on('facebook')
e = raises(lambda: rs.collect('facebook', 'https://w.example', 'k', {'ns': 'aep'}, log, http=http, runner=r, sleep=lambda s: None, clock=lambda: 1794300000), rs.Unavailable)
t('the job asks opencli who is signed in first, and stops when nobody is', bool(e) and e.why == 'needs_login' and [c[1:3] for c in calls] == [['facebook', 'whoami']], (e, calls))
fresh(); r, calls = nat(); on('facebook'); lines = []; posted = []
out = rs.collect('facebook', 'https://w.example', 'k', {'ns': 'aep'}, log, http=http, runner=r, sleep=lambda s: None, clock=lambda: 1794300000)
t('signed in, the job files its posts as layer 2', out['ok'] and posted and posted[0]['layer'] == 2 and posted[0]['rows'], out.get('summary'))
t('  and the signed-in account\'s name reaches no log and no row', 'agency.monitor' not in json.dumps(lines) and 'A Person' not in json.dumps(lines) and 'agency.monitor' not in json.dumps(posted))

# signing in
answers = iter(['no', 'facebook']); said = []; ran = []
r, calls = nat(who=True)
ok = rs.login('facebook', ask=lambda q: said.append(q) or next(answers), out=said.append, call=lambda c: ran.append(c) or 0, runner=r)
t('Facebook through opencli: the warning, the client-admin question, then opencli\'s own login', ok is True and ran == [['opencli', 'facebook', 'login']] and bool(rs.state('facebook').get('switched_on')) and any('NEVER' in str(x) or 'administers' in str(x) for x in said), (ok, ran, said[-2:]))
fresh(); r, calls = nat(who=False); answers = iter(['no', 'instagram']); said = []; ran = []
ok = rs.login('instagram', ask=lambda q: next(answers), out=said.append, call=lambda c: ran.append(c) or 0, runner=r)
t('nothing is switched on when opencli still reports nobody signed in', ok is False and not rs.state('instagram').get('switched_on') and 'Nothing was switched on' in said[-1], said[-1:])
fresh(); r, calls = nat(); said = []; ran = []
ok = rs.login('facebook', ask=lambda q: 'yes', out=said.append, call=lambda c: ran.append(c) or 0, runner=r)
t('a profile that administers a client asset stops the sign-in', ok is False and ran == [], said[-1:])
WHO = {'logged_in': True, 'site': 'facebook', 'user_id': '100000000000001', 'vanity': 'a.person', 'profile_url': 'https://www.facebook.com/a.person/'}
fresh(); r, _ = nat({('facebook', 'whoami'): (0, json.dumps(WHO) + '\n\n  Update available: v1 -> v2\n', '')})
t('whoami answering one object, not a list, still counts as signed in', rs.native_who('facebook', r) == (True, ''), rs.native_who('facebook', r))
r, _ = nat({('facebook', 'whoami'): (0, json.dumps([dict(WHO, logged_in=False)]), '')})
t('a row that says logged_in false is nobody signed in', rs.native_who('facebook', r)[0] is False)
r, _ = nat({('facebook', 'whoami'): (0, 'logged_in: true\nuser_id: 100000000000001\nvanity: a.person\n', 'warn 100000000000001 https://www.facebook.com/a.person/')})
ok, why = rs.native_who('facebook', r)
t('an answer in another shape says its shape and names nobody', ok is False and 'not JSON' in why and 'a.person' not in why and '100000000000001' not in why, why)
answers = iter(['no', 'facebook']); said = []
rs.login('facebook', ask=lambda q: next(answers), out=said.append, call=lambda c: 0, runner=r)
t('and signing in then says why it was not confirmed', 'not JSON' in said[-1] and 'Nothing was switched on' in said[-1], said[-1:])
fresh(); r, calls = nat(); answers = iter(['no', 'instagram']); said = []; ran = []
REFUSED = 'ok: false\nerror:\n  code: COMMAND_EXEC\n  message: HTTP 429 from Instagram /users/info\n  exitCode: 1\n'
ok = rs.login('instagram', ask=lambda q: next(answers), out=said.append, call=lambda c: ran.append(c) or (1, REFUSED), runner=r)
t('a sign-in the platform refuses with 429 switches nothing on and pauses it for 24 hours', ok is False and not rs.state('instagram').get('switched_on') and rs.paused('instagram')[0] > rs.time.time() + 23 * 3600 and '24 hours' in said[-1], said[-1:])
asked = []; ran = []; said = []
ok = rs.login('instagram', ask=lambda q: asked.append(q) or 'no', out=said.append, call=lambda c: ran.append(c) or (0, ''), runner=r)
t('and a second try inside the day stops before any question and runs nothing', ok is False and asked == [] and ran == [] and 'paused' in said[-1], said[-1:])
t('  and the paused platform is not offered', 'instagram' not in rs.offered(runner=r))
fresh(); r, calls = nat(); answers = iter(['no', 'facebook']); said = []
ok = rs.login('facebook', ask=lambda q: next(answers), out=said.append, call=lambda c: (1, 'Error: Facebook checkpoint: verify it\'s you'), runner=r)
t('a verification at sign-in pauses the platform the same way', ok is False and rs.paused('facebook')[0] > 0 and 'verification' in said[-1], said[-1:])
fresh(); r, calls = nat(); answers = iter(['no', 'facebook']); said = []
ok = rs.login('facebook', ask=lambda q: next(answers), out=said.append, call=lambda c: (1, 'Error: window closed'), runner=r)
t('a sign-in that simply did not finish pauses nothing', ok is False and rs.paused('facebook')[0] == 0 and 'did not finish' in said[-1], said[-1:])
fresh(); r, calls = nat({('facebook', 'whoami'): (1, '', 'HTTP 429 Too Many Requests')}); answers = iter(['no', 'facebook']); said = []
ok = rs.login('facebook', ask=lambda q: next(answers), out=said.append, call=lambda c: (0, 'ok'), runner=r)
t('a refusal of the check after signing in pauses it too', ok is False and rs.paused('facebook')[0] > 0 and not rs.state('facebook').get('switched_on'), said[-1:])
rs._which = lambda b: None

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
