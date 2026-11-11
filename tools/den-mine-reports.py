#!/usr/bin/env python3
"""
den-mine-reports.py - what the analyst's own past reports name, proposed to a desk's watch register (DEN.md, Phase 5).

It reads a folder of exported reports (.docx .txt .md .html, and .pdf when pdftotext is installed) and counts, across
the reports, the things a collector could watch:

  accounts   the profiles behind the social links the reports cite (X, Facebook, Instagram, YouTube)
  groups     public Facebook groups linked
  outlets    the sites of the other links
  hashtags   every #tag written out
  terms      names and phrases written with capitals ("Scott Reef", "Rewiring Australia") that recur

Only what appears in at least --min reports (default 2) is proposed. With --key the live lexicon is read first, so a
term the desk already matches is left out. It prints what it would send and sends nothing without --apply. With
--apply the candidates go to POST /den/watch/propose as source "reports": they are PROPOSALS, read by nothing until a
person approves each one in the Watch view. Only the candidate and how many reports named it are sent: no sentence of
any report leaves the Mac.

The reports are client material. Keep them outside the repository: a folder inside it is refused.
Capitalised phrases include people's names. Approve a person's name as a term only when they are a public figure.

Usage:
  python3 tools/den-mine-reports.py ~/Documents/briefs-aep --ns aep                       # what it finds, nothing sent
  python3 tools/den-mine-reports.py ~/Documents/briefs-aep --ns aep --key $AXIOM_KEY --apply
"""
import argparse, html, json, os, re, shutil, subprocess, sys, urllib.request, zipfile

WORKER = 'https://newsaus.heshan-998.workers.dev'
REPO = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SOCIAL = re.compile(r'(^|\.)(facebook\.com|fb\.com|fb\.watch|instagram\.com|x\.com|twitter\.com|t\.co|youtube\.com|youtu\.be|tiktok\.com|threads\.net|threads\.com|linkedin\.com|lnkd\.in|reddit\.com|redd\.it|bsky\.app|google\.com|goo\.gl|bit\.ly|tinyurl\.com|apple\.com|spotify\.com|docs\.google\.com|drive\.google\.com)$')
NOT_PROFILE = {'x': {'i', 'home', 'search', 'hashtag', 'intent', 'share', 'explore', 'settings', 'notifications', 'messages'},
               'facebook': {'groups', 'watch', 'reel', 'share', 'photo', 'photo.php', 'story.php', 'permalink.php', 'events', 'hashtag', 'profile.php', 'people', 'pages', 'login', 'sharer', 'sharer.php', 'marketplace', 'gaming'},
               'instagram': {'p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts'},
               'youtube': {'watch', 'shorts', 'playlist', 'results', 'feed', 'live', 'embed', 'channel', 'c', 'user'}}
# words that open a sentence or a heading with a capital and are not a name
PLAIN = set('the a an and or but for nor so yet in on at by to of from with as is are was were be been this that these those it its their there here our we you they he she his her not no all any each some most more many few several other another such only own same both either neither one two three four five six seven eight nine ten first second third last next new old key main top source sources list summary executive today yesterday tomorrow monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december risks implications bottom line recommended posture momentum assessment sentiment tone traditional media coverage social activity influencer political narratives developments judgement environment overall level low medium high moderate stable escalating elevated daily weekly brief report update note'.split())


def text_of(path):
    """A report's words, with every link it carries written out. '' when it cannot be read."""
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == '.docx':
            with zipfile.ZipFile(path) as z:
                body = z.read('word/document.xml').decode('utf-8', 'replace')
                rels = z.read('word/_rels/document.xml.rels').decode('utf-8', 'replace') if 'word/_rels/document.xml.rels' in z.namelist() else ''
            links = re.findall(r'Target="(https?://[^"]+)"', rels)
            body = re.sub(r'</w:p>', '\n', body); body = re.sub(r'<[^>]+>', '', body)
            return html.unescape(body) + '\n' + '\n'.join(html.unescape(u) for u in links)
        if ext in ('.html', '.htm'):
            raw = open(path, encoding='utf-8', errors='replace').read()
            links = re.findall(r'(?i)href="(https?://[^"]+)"', raw)
            raw = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', raw); raw = re.sub(r'(?i)<br\s*/?>|</p>|</div>|</li>|</h\d>', '\n', raw)
            return html.unescape(re.sub(r'<[^>]+>', ' ', raw)) + '\n' + '\n'.join(html.unescape(u) for u in links)
        if ext in ('.txt', '.md'):
            return open(path, encoding='utf-8', errors='replace').read()
        if ext == '.pdf' and shutil.which('pdftotext'):
            return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, timeout=120).stdout
    except Exception:
        return ''
    return ''


def profile_of(url):
    """(kind, platform, value) for a link to a profile or to a post that names its profile; None for anything else."""
    m = re.match(r'(?i)https?://(?:www\.|m\.|mobile\.|web\.)?([a-z0-9.-]+)/([^?#\s]*)', url)
    if not m: return None
    host = m.group(1).lower(); seg = [s for s in m.group(2).split('/') if s]
    pf = 'x' if host in ('x.com', 'twitter.com') else 'facebook' if host in ('facebook.com', 'fb.com') else 'instagram' if host == 'instagram.com' else 'youtube' if host == 'youtube.com' else ''
    if not pf or not seg: return None
    first = seg[0]
    if pf == 'facebook' and first == 'groups' and len(seg) > 1 and re.match(r'^[A-Za-z0-9._-]{2,80}$', seg[1]): return ('group', 'facebook', seg[1].lower())
    if pf == 'youtube':
        return ('account', 'youtube', first.lower()) if first.startswith('@') and re.match(r'^@[A-Za-z0-9._-]{2,60}$', first) else None
    if first.lower() in NOT_PROFILE[pf] or not re.match(r'^[A-Za-z0-9._]{2,60}$', first) or re.match(r'^\d+$', first): return None
    if pf == 'instagram' and len(seg) > 1 and seg[1] not in ('p', 'reel', 'reels'): return None
    return ('account', pf, first.lower())


def host_of(url):
    m = re.match(r'(?i)https?://([a-z0-9.-]+)', url)
    if not m: return ''
    h = re.sub(r'^(www|m|mobile|amp)\.', '', m.group(1).lower())
    return '' if SOCIAL.search(h) or '.' not in h else h


def phrases_of(text):
    """Runs of two to four capitalised words: names of places, projects and organisations."""
    out = set()
    for line in re.split(r'[\n.!?;:()\[\]"|]+', re.sub(r'https?://\S+', ' ', text)):
        words = re.findall(r"[A-Za-z][A-Za-z'&-]*|\d+", line)
        run = []
        for w in words + ['']:
            if w[:1].isupper() and len(w) > 1 and not w.isupper() or (w.isupper() and 2 < len(w) < 7 and run):
                run.append(w)
            else:
                while run and run[0].lower() in PLAIN: run.pop(0)
                while run and run[-1].lower() in PLAIN: run.pop()
                if 2 <= len(run) <= 4 and not all(x.lower() in PLAIN for x in run): out.add(' '.join(run).lower())
                run = []
    return out


def mine(folder, minimum=2, lexicon=None):
    """{'reports': n, 'unread': [names], 'candidates': [{kind, platform, value, reports}]} - counted by report, not by mention."""
    files = sorted(os.path.join(dp, f) for dp, _, fs in os.walk(folder) for f in fs if os.path.splitext(f)[1].lower() in ('.docx', '.txt', '.md', '.html', '.htm', '.pdf'))
    seen = {}; read = 0; unread = []
    for path in files:
        text = text_of(path)
        if len(text.strip()) < 200: unread.append(os.path.basename(path)); continue
        read += 1; mine_ = set()
        for u in set(re.findall(r'https?://[^\s<>"\')\]]+', text)):
            u = u.rstrip('.,;')
            p = profile_of(u)
            if p: mine_.add(p); continue
            h = host_of(u)
            if h: mine_.add(('source', 'web', h))
        for tag in set(t.lower() for t in re.findall(r'(?<![A-Za-z0-9&/])#([A-Za-z][A-Za-z0-9_]{2,40})', text)): mine_.add(('hashtag', 'any', tag))
        for ph in phrases_of(text): mine_.add(('term', 'any', ph))
        for k in mine_: seen[k] = seen.get(k, 0) + 1
    rx = []
    for i in (lexicon or []):
        try: rx.append(re.compile(i.get('wide') or i.get('rx'), re.I))
        except Exception: pass
    cands = [{'kind': k[0], 'platform': k[1], 'value': k[2], 'reports': n} for k, n in seen.items() if n >= minimum and not (k[0] == 'term' and any(r.search(k[2]) for r in rx))]
    order = {'account': 0, 'group': 1, 'hashtag': 2, 'source': 3, 'term': 4}
    cands.sort(key=lambda c: (order[c['kind']], -c['reports'], c['value']))
    return {'reports': read, 'unread': unread, 'candidates': cands}


def call(url, key, body=None, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET', headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': 'axiom-den-mine/1'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode() or '{}')
        except Exception: return {'ok': False, 'error': 'http_%d' % e.code}


def inside_repo(folder):
    f = os.path.realpath(os.path.expanduser(folder))
    return f == REPO or f.startswith(REPO + os.sep)


def run(folder, ns, worker, key, apply, minimum=2, send=call, out=print):
    if inside_repo(folder):
        raise SystemExit('That folder is inside the AXIOM repository. Reports are client material and never go there: move them somewhere else and point this at that folder.')
    if not os.path.isdir(os.path.expanduser(folder)): raise SystemExit('No such folder: ' + folder)
    worker = worker.rstrip('/'); lexicon = None
    if key:
        got = send(worker + '/reddit/issues', key)
        lexicon = [i for i in (got.get('issues') or []) if i.get('ns') == ns]
        if not got.get('issues'): out('The live lexicon could not be read (%s): terms the desk already matches are not left out.' % (got.get('error') or 'no answer'))
    else:
        out('No --key: the live lexicon was not read, so terms the desk already matches are not left out.')
    found = mine(os.path.expanduser(folder), minimum, lexicon)
    c = found['candidates']; by = {}
    for x in c: by[x['kind']] = by.get(x['kind'], 0) + 1
    out('%d reports read%s. Named in at least %d of them: %s.' % (found['reports'], (', %d could not be read (%s)' % (len(found['unread']), ', '.join(found['unread'][:4]))) if found['unread'] else '', minimum,
        ', '.join('%d %s%s' % (by[k], k, '' if by[k] == 1 else 's') for k in ('account', 'group', 'hashtag', 'source', 'term') if by.get(k)) or 'nothing'))
    for x in c[:400]: out('  %-8s %-10s %-44s %d reports' % (x['kind'], x['platform'] if x['kind'] in ('account', 'group') else '', x['value'], x['reports']))
    if not apply:
        out('Nothing was sent. Add --apply (with --key) to propose these to the %s desk; each still waits for a person.' % ns); return {'sent': 0, 'found': len(c)}
    if not key: raise SystemExit('--apply needs --key.')
    tot = {'sent': 0, 'proposed': 0, 'known': 0, 'refused': 0, 'found': len(c)}
    for i in range(0, len(c), 200):
        part = c[i:i + 200]
        r = send(worker + '/den/watch/propose', key, {'ns': ns, 'source': 'reports', 'items': [{'kind': x['kind'], 'platform': x['platform'], 'value': x['value'], 'score': x['reports'], 'reason': 'Named in %d of %d reports read.' % (x['reports'], found['reports'])} for x in part]})
        if not r.get('ok'): raise SystemExit('The worker refused the proposals: %s %s' % (r.get('error') or '', r.get('detail') or ''))
        tot['sent'] += len(part); tot['proposed'] += r.get('proposed') or 0; tot['known'] += r.get('known') or 0; tot['refused'] += len(r.get('refused') or [])
    out('%d proposed to the %s desk, %d already in its register (approved, switched off or dismissed), %d not something the register can hold. Open the Watch view to decide each.' % (tot['proposed'], ns, tot['known'], tot['refused']))
    return tot


def main(argv=None):
    ap = argparse.ArgumentParser(description='what past reports name, proposed to a desk\'s watch register')
    ap.add_argument('folder'); ap.add_argument('--ns', required=True); ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--worker', default=WORKER); ap.add_argument('--min', type=int, default=2); ap.add_argument('--apply', action='store_true')
    a = ap.parse_args(argv)
    run(a.folder, a.ns.lower(), a.worker, a.key, a.apply, max(1, a.min))


if __name__ == '__main__':
    main()
