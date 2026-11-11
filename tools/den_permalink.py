#!/usr/bin/env python3
"""
den_permalink.py - one post, one address, whatever form it was found under.

The mirror of canonPermalink() in the worker. Every collector on the Mac hands
its posts to the worker with the address made canonical here first, so a post
found by two collectors is one row. Both sides are held to the same cases:
tests/fixtures/den/permalinks.json.

    canon_permalink('x', 'https://twitter.com/someone/status/123...')  -> 'https://x.com/i/web/status/123...'

Returns '' when the address is not a post on that platform (an account page, a
script address), so nothing that is not a post is filed as one. The X form
carries no handle on purpose: handles are never stored.

Facebook's opaque "pfbid" form cannot be matched to the numeric one; such a
post may be held under both.
"""
import re
from urllib.parse import urlsplit, parse_qsl, quote

_TRACK = re.compile(r'^(utm_[a-z_]+|fbclid|gclid|igsh|igshid|mibextid|ref|ref_src|s|si|t)$', re.I)
_HOST_PREFIX = re.compile(r'^(www|m|mobile|web|mbasic|touch)\.')
_TOK = re.compile(r'^[A-Za-z0-9._-]{2,120}$')


def _num(s):
    return bool(re.match(r'^\d{5,}$', str(s or '')))


def _tok(s):
    return bool(_TOK.match(str(s or '')))


def canon_permalink(platform, url):
    try:
        u = urlsplit(str(url or '').strip())
    except Exception:
        return ''
    if u.scheme not in ('http', 'https') or not u.hostname:
        return ''
    host = _HOST_PREFIX.sub('', u.hostname.lower())
    seg = [s for s in u.path.split('/') if s]
    pairs = parse_qsl(u.query, keep_blank_values=True)
    q = dict(pairs)
    g = lambda k: q.get(k, '')
    s0 = seg[0] if seg else ''
    if platform == 'x':
        if host not in ('x.com', 'twitter.com'):
            return ''
        i = seg.index('status') if 'status' in seg else -1
        pid = seg[i + 1] if i >= 0 and i + 1 < len(seg) else ''
        return 'https://x.com/i/web/status/' + pid if _num(pid) else ''
    if platform == 'instagram':
        if host != 'instagram.com':
            return ''
        i = next((n for n, s in enumerate(seg) if re.match(r'^(p|reel|reels|tv)$', s)), -1)
        code = seg[i + 1] if i >= 0 and i + 1 < len(seg) else ''
        return 'https://www.instagram.com/p/' + code + '/' if re.match(r'^[A-Za-z0-9_-]{5,40}$', code) else ''
    if platform == 'youtube':
        vid = ''
        if host == 'youtu.be':
            vid = s0
        elif host in ('youtube.com', 'music.youtube.com'):
            vid = g('v') if s0 == 'watch' else (seg[1] if re.match(r'^(shorts|live|embed|v)$', s0) and len(seg) > 1 else '')
        return 'https://www.youtube.com/watch?v=' + vid if re.match(r'^[A-Za-z0-9_-]{11}$', vid or '') else ''
    if platform == 'facebook':
        if host not in ('facebook.com', 'fb.com'):
            return ''
        F = 'https://www.facebook.com/'
        if len(seg) == 1 and re.match(r'^\d{5,}_\d{5,}$', s0):
            a, b = s0.split('_')
            return F + a + '/posts/' + b
        if re.match(r'^(story|permalink)\.php$', s0):
            return F + g('id') + '/posts/' + g('story_fbid') if _tok(g('story_fbid')) and _num(g('id')) else ''
        if s0 in ('photo.php', 'photo'):
            return F + 'photo/?fbid=' + g('fbid') if _num(g('fbid')) else ''
        if s0 == 'watch':
            return F + 'watch/?v=' + g('v') if _num(g('v')) else ''
        if s0 == 'reel':
            return F + 'reel/' + seg[1] if len(seg) > 1 and _num(seg[1]) else ''
        if s0 == 'share':
            return F + 'share/' + seg[1] + '/' + seg[2] if len(seg) > 2 and re.match(r'^[prv]$', seg[1]) and _tok(seg[2]) else ''
        if s0 == 'groups':
            return F + 'groups/' + seg[1].lower() + '/posts/' + seg[3] if len(seg) > 3 and _tok(seg[1]) and seg[2] in ('posts', 'permalink') and _tok(seg[3]) else ''
        if len(seg) >= 3 and seg[1] in ('posts', 'videos', 'photos') and _tok(s0):
            pid = seg[-1] if seg[1] == 'photos' else seg[2]
            return F + s0.lower() + '/' + seg[1] + '/' + pid if _tok(pid) else ''
        return ''
    keep = [quote(k, safe='') + '=' + quote(v, safe='') for k, v in pairs if not _TRACK.match(k)]
    path = re.sub(r'/+$', '', u.path)
    return u.scheme + '://' + u.hostname.lower() + path + ('?' + '&'.join(keep) if keep else '')


if __name__ == '__main__':
    import sys
    if len(sys.argv) != 3:
        sys.exit('usage: den_permalink.py <platform> <url>')
    print(canon_permalink(sys.argv[1], sys.argv[2]))
