#!/usr/bin/env python3
"""tools/studio-test-kit.py against a stand-in worker (a local HTTP server that records every request). Nothing leaves this machine.
Run: python3 tests/studio-test-kit-test.py"""
import json, os, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOL = os.path.join(ROOT, 'tools', 'studio-test-kit.py')
SEEN = []


class Stub(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body):
        b = json.dumps(body).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        SEEN.append(('GET', self.path, None, self.headers.get('X-Axiom-Key')))
        if self.path.startswith('/studio/status'):
            return self._send(200, {'build': '2026-11-07.studio-p45', 'testNs': [{'ns': 'synthdemo', 'name': ''}]})
        if self.path.startswith('/studio/list'):
            return self._send(200, {'projects': [{'id': 'p1', 'title': 'TEST - one', 'test': True}, {'id': 'p2', 'title': 'TEST - two', 'test': True}]})
        self._send(404, {})

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0); body = json.loads(self.rfile.read(n).decode() or '{}')
        SEEN.append(('POST', self.path, body, self.headers.get('X-Axiom-Key')))
        if self.path == '/studio/project':
            return self._send(200, {'id': 'p' + str(len(SEEN)), 'existing': False, 'test': True})
        if self.path in ('/studio/direction', '/studio/source', '/studio/reference'):
            return self._send(200, {'ok': True, 'id': 'x' + str(len(SEEN))})
        if self.path == '/studio/asset':
            return self._send(200, {'ok': True, 'asset': {'id': 'a' + str(len(SEEN)), 'current': 'v1', 'revision': 1, 'versions': [{'id': 'v1', 'layout': {'layers': [{'id': 'h', 'role': 'headline', 'x': 6, 'y': 60}, {'id': 's', 'role': 'support', 'x': 6, 'y': 75}]}}]}})
        if self.path == '/studio/project/archive-tests':
            return self._send(200, {'archived': [{'id': 'p1', 'title': 'TEST - one'}, {'id': 'p2', 'title': 'TEST - two'}]})
        self._send(200, {'ok': True})


srv = HTTPServer(('127.0.0.1', 0), Stub); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d' % srv.server_port
passed = failed = 0


def run(*args):
    r = subprocess.run([sys.executable, TOOL] + list(args) + ['--worker', BASE, '--key', 'full-key-test'], capture_output=True, text=True, timeout=60)
    return r.returncode, r.stdout + r.stderr


def t(name, fn):
    global passed, failed
    SEEN.clear()
    try:
        fn(); passed += 1; print('  ok   ' + name)
    except AssertionError as e:
        failed += 1; print('  FAIL ' + name + '\n       ' + str(e)[:400])


def dry_seed():
    code, out = run('seed'); assert code == 0, out
    assert not SEEN, 'a dry run sends nothing: %r' % SEEN
    assert 'would send POST /brand/kit' in out and 'Add --apply' in out, out
t('seed without --apply shows the plan and sends nothing', dry_seed)


def seed():
    code, out = run('seed', '--apply'); assert code == 0, out
    posts = [s for s in SEEN if s[0] == 'POST']
    kits = [s for s in posts if s[1] == '/brand/kit']; projs = [s for s in posts if s[1] == '/studio/project']
    assert len(kits) == 3 and all(s[2]['ns'] == 'synthdemo' for s in kits), kits
    assert 'SYNTHETIC' in kits[0][2]['name'] and any(f['status'] == 'pending' for f in kits[0][2]['facts']), kits[0][2]
    import base64
    logo = base64.b64decode(kits[1][2]['logoB64']); assert logo[:8] == b'\x89PNG\r\n\x1a\n' and int.from_bytes(logo[16:20], 'big') == 320, 'a real PNG with its size'
    assert len(projs) == 7 and all(s[2]['test'] is True and s[2]['ns'] == 'synthdemo' and s[2]['idem'] for s in projs), projs
    vers = [s for s in posts if s[1] == '/studio/version']
    assert len(vers) == 4 and all(v[2]['layout']['noImagery'] is True for v in vers), 'four tiles laid out on a solid ground: %r' % vers
    blocked = [v for v in vers if v[2]['layout']['layers'][1]['y'] == v[2]['layout']['layers'][0]['y']]
    assert len(blocked) == 1, 'exactly one tile laid out to block'
    assert not [s for s in posts if s[1] == '/studio/approve'], 'the seed approves nothing'
    assert all(s[3] == 'full-key-test' for s in SEEN), 'the key goes in the header only'
    assert 'full-key-test' not in out, 'the key is never printed'
t('seed --apply writes the synthetic kit (with real PNG marks) and seven parked test projects to synthdemo, approving nothing', seed)


def live_refused():
    code, out = run('seed', '--apply', '--ns', 'mca'); assert code != 0 and 'live client' in out, out
    assert not SEEN, 'nothing sent for a live client'
t('a live client namespace is refused before anything is sent', live_refused)


def reset():
    code, out = run('reset'); assert code == 0 and 'TEST - one' in out and 'Nothing was archived' in out, out
    assert [s[0] for s in SEEN] == ['GET'], 'a dry reset only lists: %r' % SEEN
    SEEN.clear(); code, out = run('reset', '--apply'); assert code == 0, out
    assert any(s[1] == '/studio/project/archive-tests' and s[2] == {'ns': 'synthdemo'} for s in SEEN), SEEN
    assert 'archived p1' in out and 'archived p2' in out, out
t('reset lists the test projects, and with --apply archives them, each named', reset)

srv.shutdown()
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
