#!/usr/bin/env python3
"""guest-link.py harness: a stub stands in for wrangler (it records what would be written to AXIOM_GUEST_KEYS and
answers `secret list`), so nothing reaches Cloudflare. Run: python3 tests/guest-link-test.py"""
import json, os, re, stat, subprocess, sys, tempfile
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.join(HERE, '..', 'tools', 'guest-link.py')
tmp = tempfile.mkdtemp(prefix='guestlink-')
STUB = os.path.join(tmp, 'wrangler-stub.py')
PUT = os.path.join(tmp, 'put.json')
FILE = os.path.join(tmp, 'guests.json')
open(STUB, 'w').write(r'''
import os, sys
args = sys.argv[1:]
if args[:2] == ['secret', 'list']:
    print('[{"name":"ANTHROPIC_API_KEY"}' + (',{"name":"AXIOM_GUEST_KEYS"}' if os.environ.get('STUB_HAS_GUESTS') else '') + ']')
elif args[:2] == ['secret', 'put']:
    if os.environ.get('STUB_FAIL'):
        sys.stderr.write('Authentication error'); sys.exit(1)
    open(os.environ['STUB_PUT'], 'w').write(sys.stdin.read())
    print('Success! Uploaded secret ' + args[2])
''')
passed = failed = 0


def run(*args, **env):
    e = dict(os.environ, AXIOM_WRANGLER=sys.executable + ' ' + STUB, STUB_PUT=PUT)
    e.update({k: v for k, v in env.items() if v is not None})
    r = subprocess.run([sys.executable, TOOL] + list(args) + ['--file', FILE], capture_output=True, text=True, env=e)
    return r.returncode, r.stdout + r.stderr


def t(name, fn):
    global passed, failed
    for p in (PUT,):
        if os.path.exists(p): os.remove(p)
    try:
        fn(); passed += 1; print('  ok   ' + name)
    except AssertionError as e:
        failed += 1; print('  FAIL ' + name + '\n       ' + str(e)[:400])


def put():
    return json.load(open(PUT)) if os.path.exists(PUT) else None


def a_new_list():
    code, out = run('add', 'Laura')
    assert code == 0, out
    m = re.search(r'https://heshan-reporting\.github\.io/Axiom/#k=([A-Za-z0-9_-]{24,})&v=studio', out); assert m, out
    g = put(); assert g and list(g.keys()) == [m.group(1)], g
    v = g[m.group(1)]; want = (datetime.now(timezone.utc).date() + timedelta(days=30)).isoformat()
    assert v == {'n': 'Laura', 'r': 'full', 'until': want}, v
    assert json.load(open(FILE)) == g, 'the file on this Mac matches what the worker got'
    assert stat.S_IMODE(os.stat(FILE).st_mode) == 0o600, oct(os.stat(FILE).st_mode)
t('add makes a key, writes the whole list to the worker, keeps it in a 600 file and prints the sign-in link', a_new_list)


def no_twice():
    before = open(FILE).read()
    code, out = run('add', 'laura'); assert code != 0 and 'already has a link' in out, out
    assert put() is None and open(FILE).read() == before, 'nothing written'
t('a second add for the same name is refused and nothing is written', no_twice)


def second_guest_keeps_first():
    code, out = run('add', 'Ben', '--until', '2999-01-31', '--read'); assert code == 0, out
    g = put(); assert sorted(v['n'] for v in g.values()) == ['Ben', 'Laura'], g
    assert [v for v in g.values() if v['n'] == 'Ben'][0] == {'n': 'Ben', 'r': 'read', 'until': '2999-01-31'}
t('a second guest is added beside the first; the worker gets both', second_guest_keeps_first)


def renew_keeps_key():
    k = [k for k, v in json.load(open(FILE)).items() if v['n'] == 'Laura'][0]
    code, out = run('renew', 'Laura', '--until', '2999-12-31'); assert code == 0 and 'works again' in out, out
    g = put(); assert g[k]['until'] == '2999-12-31' and g[k]['r'] == 'full', g[k]
    assert '#k=' not in out, 'renew sends nothing new'
t('renew moves the end date on the same key, so the old link works again', renew_keeps_key)


def list_hides_keys():
    keys = list(json.load(open(FILE)).keys())
    code, out = run('list'); assert code == 0 and 'Laura' in out and 'Ben' in out and 'read' in out, out
    assert not any(k in out for k in keys), 'list never prints a key'
    assert put() is None, 'list writes nothing'
t('list names the guests, roles and end dates and never prints a key', list_hides_keys)


def link_reprints():
    k = [k for k, v in json.load(open(FILE)).items() if v['n'] == 'Ben'][0]
    code, out = run('link', 'ben'); assert code == 0 and ('#k=' + k + '&v=studio') in out, out
t('link prints a guest\'s link again', link_reprints)


def remove_one():
    code, out = run('remove', 'Ben'); assert code == 0, out
    g = put(); assert [v['n'] for v in g.values()] == ['Laura'], g
t('remove takes one guest out and keeps the rest', remove_one)


def refused_put_changes_nothing():
    before = open(FILE).read()
    code, out = run('add', 'Ju', STUB_FAIL='1'); assert code != 0 and 'refused' in out, out
    assert open(FILE).read() == before, 'the file is only written after the worker took the list'
t('when the worker refuses the list, the file on this Mac is left as it was', refused_put_changes_nothing)


def stop_without_file():
    os.rename(FILE, FILE + '.away')
    try:
        code, out = run('add', 'Ju', STUB_HAS_GUESTS='1'); assert code != 0 and out.startswith('STOP'), out
        assert put() is None and not os.path.exists(FILE), 'nothing written'
    finally:
        os.rename(FILE + '.away', FILE)
t('STOP when the worker has guest keys but this Mac has no list (writing would end every old link)', stop_without_file)


def past_date():
    code, out = run('add', 'Ju', '--until', '2020-01-01'); assert code != 0 and 'already started' in out, out
    assert put() is None
t('an end date that has started is refused', past_date)

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
