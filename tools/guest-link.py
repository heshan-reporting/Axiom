#!/usr/bin/env python3
"""guest-link.py - give a tester their own AXIOM sign-in link, renew one, remove one, list them.

Guest keys live in the worker secret AXIOM_GUEST_KEYS ({"<key>": {"n": name, "r": "full"|"read", "until": "YYYY-MM-DD"}}).
Cloudflare cannot show a secret back, so this tool keeps the list in ~/.axiom-guests.json (mode 600) on this Mac and
writes the whole list to the worker each time. Keys are made here and never leave this machine except as the link you
send the person.

  python3 tools/guest-link.py add Laura                  # her own full-access link, ending in 30 days
  python3 tools/guest-link.py add Ben --until 2026-12-31 --read
  python3 tools/guest-link.py renew Kai --until 2026-12-31   # his old link works again; nothing new to send
  python3 tools/guest-link.py link Laura                 # print her link again
  python3 tools/guest-link.py remove Ben                 # his link stops working
  python3 tools/guest-link.py list                       # names, roles, end dates; never the keys

The end date is midnight UTC at the start of that day. After it the link answers "Your sign-in link has ended", unless
open access (AXIOM_PUBLIC) is still on, in which case the person gets the open role.
Options: --worker newsaus, --site https://heshan-reporting.github.io/Axiom/, --view studio, --file PATH, --dry-run.
"""
import argparse, json, os, re, secrets, shlex, subprocess, sys
from datetime import date, datetime, timedelta, timezone

FILE = os.path.expanduser('~/.axiom-guests.json')
SITE = 'https://heshan-reporting.github.io/Axiom/'


def wrangler():
    # AXIOM_WRANGLER lets the tests put a stub in place of npx wrangler
    return shlex.split(os.environ.get('AXIOM_WRANGLER', 'npx wrangler'))


def secret_exists(worker):
    out = subprocess.run(wrangler() + ['secret', 'list', '--name', worker], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit('Could not list the worker\'s secrets (is wrangler logged in?):\n' + (out.stderr or out.stdout)[-600:])
    return 'AXIOM_GUEST_KEYS' in out.stdout


def load(path, worker, dry):
    g = {}
    if os.path.exists(path):
        try:
            g = json.load(open(path))
        except Exception as e:
            sys.exit('%s is not readable JSON (%s). Fix or move it; nothing was changed.' % (path, e))
        if not isinstance(g, dict):
            sys.exit('%s is not a list of guests; nothing was changed.' % path)
    elif not dry and secret_exists(worker):
        sys.exit('STOP: the worker already has guest keys but %s is not on this Mac, and Cloudflare cannot show the '
                 'secret back. Writing a new list would end every existing guest link. Run this on the Mac that made '
                 'them, or pass --fresh to start a new list on purpose (every old guest link stops working).' % path)
    return g


def save(g, path, worker, dry):
    body = json.dumps(g)
    if dry:
        print('(dry run: the worker was not changed)')
    else:
        r = subprocess.run(wrangler() + ['secret', 'put', 'AXIOM_GUEST_KEYS', '--name', worker], input=body, text=True,
                           capture_output=True)
        if r.returncode != 0:
            sys.exit('The worker refused the new list; nothing was changed:\n' + (r.stderr or r.stdout)[-600:])
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(g, f, indent=1)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def until_of(a):
    if a.until:
        try:
            d = date.fromisoformat(a.until)
        except ValueError:
            sys.exit('--until must be a date like 2026-12-31')
    else:
        d = datetime.now(timezone.utc).date() + timedelta(days=a.days)
    if d <= datetime.now(timezone.utc).date():
        sys.exit('The end date %s has already started; pick a later one.' % d.isoformat())
    return d.isoformat()


def find(g, name):
    n = name.strip().lower()
    return [k for k, v in g.items() if str(v.get('n', '')).strip().lower() == n]


def link(a, k):
    return a.site.rstrip('/') + '/#k=' + k + ('&v=' + a.view if a.view else '')


def state(v):
    u = v.get('until')
    if not u:
        return 'no end date'
    return ('ended ' if datetime.now(timezone.utc).date() >= date.fromisoformat(u[:10]) else 'until ') + u


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('action', choices=['add', 'renew', 'link', 'remove', 'list'])
    p.add_argument('name', nargs='?')
    p.add_argument('--until', help='end date YYYY-MM-DD (default: --days from today)')
    p.add_argument('--days', type=int, default=30)
    p.add_argument('--read', action='store_true', help='read-only (default: full, can create projects and run model calls)')
    p.add_argument('--worker', default='newsaus')
    p.add_argument('--site', default=SITE)
    p.add_argument('--view', default='studio', help='view the link opens (empty for the front page)')
    p.add_argument('--file', default=FILE)
    p.add_argument('--fresh', action='store_true', help='start a new guest list even though the worker has one')
    p.add_argument('--dry-run', action='store_true')
    a = p.parse_args()
    if a.action != 'list' and not (a.name and a.name.strip()):
        sys.exit('Name the person: guest-link.py %s <name>' % a.action)
    if a.name and not re.match(r"^[\w .'-]{1,40}$", a.name.strip()):
        sys.exit('Use a plain name of up to 40 characters.')
    g = {} if a.fresh else load(a.file, a.worker, a.dry_run)

    if a.action == 'list':
        if not g:
            print('No guest links on this Mac.')
        for v in sorted(g.values(), key=lambda v: str(v.get('n', '')).lower()):
            print('%-24s %-5s %s' % (v.get('n', '?'), v.get('r', '?'), state(v)))
        return
    hits = find(g, a.name)
    if a.action == 'link':
        if not hits:
            sys.exit('No guest called %s. Add one: guest-link.py add "%s"' % (a.name, a.name))
        for k in hits:
            print('%s (%s, %s):\n%s' % (g[k]['n'], g[k]['r'], state(g[k]), link(a, k)))
        return
    if a.action == 'remove':
        if not hits:
            sys.exit('No guest called %s; nothing was changed.' % a.name)
        for k in hits:
            del g[k]
        save(g, a.file, a.worker, a.dry_run)
        print('Removed %s: %d link%s stopped working.' % (a.name, len(hits), '' if len(hits) == 1 else 's'))
        return
    until = until_of(a)
    if a.action == 'renew':
        if not hits:
            sys.exit('No guest called %s. Add one: guest-link.py add "%s"' % (a.name, a.name))
        for k in hits:
            g[k]['until'] = until
            if a.read:
                g[k]['r'] = 'read'
        save(g, a.file, a.worker, a.dry_run)
        print('%s\'s link works again until %s (midnight UTC at its start). Nothing new to send; they reload the page.'
              % (a.name, until))
        return
    if hits:
        sys.exit('%s already has a link. Renew it (guest-link.py renew "%s" --until DATE) or print it '
                 '(guest-link.py link "%s").' % (a.name, a.name, a.name))
    k = secrets.token_urlsafe(24)
    g[k] = {'n': a.name.strip(), 'r': 'read' if a.read else 'full', 'until': until}
    save(g, a.file, a.worker, a.dry_run)
    print('Send this to %s privately (it is their key; it ends %s, midnight UTC):\n%s' % (a.name.strip(), until, link(a, k)))


if __name__ == '__main__':
    main()
