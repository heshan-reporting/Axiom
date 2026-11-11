#!/usr/bin/env python3
"""
supermetrics2signals.py - public Facebook and Instagram posts from saved
Supermetrics results -> one payload for the worker's POST /signals/ingest.

This is layer 1 of the monitoring desk's collection (DEN.md): the platforms'
own programmes, read through the Supermetrics public-data connectors in a
Claude Code session. It needs the "Facebook Public Data" and "Instagram Public
Data" sources on the agency's Supermetrics licence; on 11 November 2026 they
were not, so the field ids below come from the connector's field discovery and
have not been checked against a live answer.

Datasets (name=file, any mix; the fields each query should ask for):
  fbposts    FBPD PagePosts, one file for any number of pages
             link,post_id,created_time,permalink_url,message,reactions_count,reactions_love,
             reactions_wow,reactions_haha,reactions_sad,reactions_angry,likes_count,comments_count,shares_count
  igposts    IGPD2 BusinessDiscoveryMedia
             username,post_id,post_timestamp,post_type,post_permalink,post_caption,post_likes,post_comments,post_views
  ighash     IGPD2 HashtagSearchMedia
             hashtag_name,post_id,post_timestamp,post_type,post_permalink,post_caption,post_likes,post_comments
  urlshares  FBPD UrlShares (how far a news address travelled on Facebook)
             url,reaction_count,comment_count,share_count

What goes in the payload: the words of a post, when it was posted, its counts
and when they were read, its canonical address, and - when the page or account
is in the client's watch register - that register row's id. Nothing that names
a person is read from the files: not a page's display name, not `from_name`.
The worker decides relevance and who may be named (a registered public actor
on its own post, nobody else).

Usage:
  python3 tools/supermetrics2signals.py out.json --ns aep --register watch.json fbposts=FILE igposts=FILE ...
  python3 tools/supermetrics2signals.py out.json --ns aep --key $AXIOM_KEY fbposts=FILE --push

--register is a saved GET /den/watch?ns=...; with --key the register is read
from the worker. --push posts the payload in batches and prints what the worker
kept; without it the file is written for the in-app Load data button.
"""
import argparse, json, os, sys, time, urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from supermetrics2rows import load, num          # the shared loader for saved Supermetrics results
from den_permalink import canon_permalink

WORKER = 'https://newsaus.heshan-998.workers.dev'
BATCH = 400


def ts_ms(s):
    s = str(s or '').strip()
    if not s:
        return 0
    try:
        if s.isdigit():
            n = int(s); return n * 1000 if n < 10 ** 11 else n
        d = datetime.fromisoformat(s.replace('Z', '+00:00').replace('+0000', '+00:00'))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return int(d.timestamp() * 1000)
    except Exception:
        return 0


def table(path):
    ids, rows = load(path)
    idx = {f: i for i, f in enumerate(ids)}
    out = []
    for r in rows:
        if len(r) != len(ids):
            continue
        out.append(lambda f, default='', r=r: r[idx[f]] if f in idx and r[idx[f]] is not None else default)
    return out


def page_alias(link):
    """The page's alias or id out of its Facebook address; '' when it is not one."""
    from urllib.parse import urlsplit, parse_qs
    try:
        u = urlsplit(str(link or ''))
    except Exception:
        return ''
    seg = [s for s in u.path.split('/') if s]
    if not seg:
        return ''
    if seg[0] in ('profile.php', 'people'):
        return (parse_qs(u.query).get('id') or [seg[-1] if len(seg) > 2 else ''])[0]
    return seg[0].lower()


def register_index(reg):
    """(platform, value) -> register id, for active accounts and hashtags."""
    rows = reg.get('watch') if isinstance(reg, dict) else reg
    idx = {}
    for r in rows or []:
        if r.get('status') == 'active' and r.get('kind') in ('account', 'hashtag'):
            idx[(r.get('platform'), str(r.get('value') or '').lower())] = r.get('id')
    return idx


def fbposts(path, reg, now):
    rows = []
    for g in table(path):
        pid = str(g('post_id')); text = str(g('message')).strip()
        url = 'https://www.facebook.com/' + pid if pid.replace('_', '').isdigit() and '_' in pid else str(g('permalink_url'))
        url = canon_permalink('facebook', url)
        if not url or not text:
            continue
        alias = page_alias(g('link')); page_id = pid.split('_')[0] if '_' in pid else ''
        rx = {k: int(num(g('reactions_' + k))) for k in ('love', 'wow', 'haha', 'sad', 'angry') if g('reactions_' + k, None) is not None}
        row = {'platform': 'facebook', 'url': url, 'text': text, 'ts': ts_ms(g('created_time')), 'eng_at': now,
               'eng': {'likes': int(num(g('reactions_count')) or num(g('likes_count'))), 'comments': int(num(g('comments_count'))), 'shares': int(num(g('shares_count'))), 'reactions': rx}}
        w = reg.get(('facebook', alias)) or reg.get(('facebook', page_id))
        if w:
            row['watch'] = w
        rows.append(row)
    return rows


def igposts(path, reg, now):
    rows = []
    for g in table(path):
        url = canon_permalink('instagram', g('post_permalink')); text = str(g('post_caption')).strip()
        if not url or not text:
            continue
        row = {'platform': 'instagram', 'url': url, 'text': text, 'ts': ts_ms(g('post_timestamp')), 'eng_at': now,
               'eng': {'likes': int(num(g('post_likes'))), 'comments': int(num(g('post_comments'))), 'views': int(num(g('post_views')))}}
        w = reg.get(('instagram', str(g('username')).lower().lstrip('@')))
        if w:
            row['watch'] = w
        rows.append(row)
    return rows


def ighash(path, reg, now):
    rows = []
    for g in table(path):
        url = canon_permalink('instagram', g('post_permalink')); text = str(g('post_caption')).strip()
        tag = str(g('hashtag_name')).split(',')[0].strip().lstrip('#').lower()
        if not url or not text:
            continue
        rows.append({'platform': 'instagram', 'url': url, 'text': text, 'ts': ts_ms(g('post_timestamp')), 'eng_at': now, 'hashtag': tag,
                     'eng': {'likes': int(num(g('post_likes'))), 'comments': int(num(g('post_comments')))}})
    return rows


def urlshares(path, reg, now):
    out = []
    for g in table(path):
        url = str(g('url')).strip()
        if url.startswith('http'):
            out.append({'url': url, 'reactions': int(num(g('reaction_count'))), 'comments': int(num(g('comment_count'))), 'shares': int(num(g('share_count')))})
    return out


DATASETS = {'fbposts': fbposts, 'igposts': igposts, 'ighash': ighash, 'urlshares': urlshares}


def build(ns, files, reg, now=None):
    now = now or int(time.time() * 1000)
    idx = register_index(reg or {})
    payload = {'ns': ns, 'layer': 1, 'via': 'supermetrics', 'rows': [], 'fb': []}
    for name, path in files:
        got = DATASETS[name](path, idx, now)
        (payload['fb'] if name == 'urlshares' else payload['rows']).extend(got)
    seen = {}
    for r in payload['rows']:                   # the same post in two files is one row, with what either file knew
        old = seen.get(r['url'])
        if old:
            for k in ('watch', 'hashtag'):
                if old.get(k) and not r.get(k):
                    r[k] = old[k]
            for k, v in old['eng'].items():     # a count only grows: the larger of the two reads, measure by measure
                if isinstance(v, int):
                    r['eng'][k] = max(v, int(r['eng'].get(k) or 0))
                elif k not in r['eng']:
                    r['eng'][k] = v
        seen[r['url']] = r
    payload['rows'] = list(seen.values())
    return payload


def batches(payload, size=BATCH):
    rows, fb = payload['rows'], payload['fb']
    for i in range(0, max(len(rows), 1), size):
        part = dict(payload, rows=rows[i:i + size], fb=fb if i == 0 else [])
        if part['rows'] or part['fb']:
            yield part
    for i in range(size, len(fb), size):         # reach figures beyond the first batch
        yield dict(payload, rows=[], fb=fb[i:i + size])


def http_json(url, key, body=None, timeout=60):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET',
                                 headers={'X-Axiom-Key': key, 'Content-Type': 'application/json', 'User-Agent': 'axiom-den/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or '{}')


def push(payload, worker, key, send=http_json, log=print):
    total = {'kept': 0, 'inserted': 0, 'updated': 0, 'fbUpdated': 0, 'off_topic': 0, 'foreign': 0, 'bad_url': 0}
    for part in batches(payload):
        if len(part['fb']) > BATCH:
            part['fb'] = part['fb'][:BATCH]
        r = send(worker.rstrip('/') + '/signals/ingest', key, part)
        if not r.get('ok'):
            raise RuntimeError('the worker refused the batch: %s - %s' % (r.get('error'), r.get('detail')))
        for k in ('kept', 'inserted', 'updated', 'fbUpdated'):
            total[k] += int(r.get(k) or 0)
        for k in ('off_topic', 'foreign', 'bad_url'):
            total[k] += int((r.get('skipped') or {}).get(k) or 0)
        log('  sent %d posts, %d reach figures: kept %d (new %d, refreshed %d)' % (len(part['rows']), len(part['fb']), r.get('kept') or 0, r.get('inserted') or 0, r.get('updated') or 0))
    return total


def main(argv=None):
    ap = argparse.ArgumentParser(description='Supermetrics public Facebook and Instagram results -> /signals/ingest payload')
    ap.add_argument('out'); ap.add_argument('files', nargs='+', help='dataset=file, e.g. fbposts=posts.json')
    ap.add_argument('--ns', required=True, help='the client these were collected for, e.g. aep')
    ap.add_argument('--register', help='a saved GET /den/watch?ns=... (so posts are tied to the register offline)')
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', '')); ap.add_argument('--worker', default=WORKER)
    ap.add_argument('--push', action='store_true', help='post the payload to the worker')
    a = ap.parse_args(argv)
    files = []
    for f in a.files:
        name, _, path = f.partition('=')
        if name not in DATASETS or not path:
            sys.exit('unknown dataset "%s": use one of %s as name=file' % (name, ', '.join(DATASETS)))
        if not os.path.isfile(os.path.expanduser(path)):
            sys.exit('No such file: %s (%s= takes the saved answer of that Supermetrics query)' % (path, name))
        files.append((name, os.path.expanduser(path)))
    reg = {}
    if a.register:
        if not os.path.isfile(os.path.expanduser(a.register)): sys.exit('No such file: %s (--register takes a saved GET /den/watch answer)' % a.register)
        try:
            reg = json.load(open(os.path.expanduser(a.register)))
        except ValueError:
            sys.exit('%s is not JSON: --register takes a saved GET /den/watch answer' % a.register)
    elif a.key:
        reg = http_json(a.worker.rstrip('/') + '/den/watch?ns=' + a.ns, a.key)
    else:
        print('no register (--register or --key): every post will be treated as found by search, and no account will be tied to it')
    payload = build(a.ns, files, reg)
    json.dump(payload, open(a.out, 'w'), indent=1)
    tied = sum(1 for r in payload['rows'] if r.get('watch'))
    print('%s: %d posts (%d from registered accounts), %d reach figures -> %s' % (a.ns, len(payload['rows']), tied, len(payload['fb']), a.out))
    if a.push:
        if not a.key:
            sys.exit('--push needs --key or AXIOM_KEY')
        t = push(payload, a.worker, a.key)
        print('the worker kept %(kept)d (new %(inserted)d, refreshed %(updated)d); off the desk\'s topics %(off_topic)d, not Australian %(foreign)d, bad address %(bad_url)d; reach written on %(fbUpdated)d news rows' % t)
    return 0


if __name__ == '__main__':
    sys.exit(main())
