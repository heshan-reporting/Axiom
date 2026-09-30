#!/usr/bin/env python3
"""
engine-ingest.py - feed a client's past work into the Engine's memory.

Point it at a folder of exports (Drive, Slack, past releases, approved tiles,
ads) or at a voice pack, and it walks everything, files the documents in the
Mind under the client's namespace, hands every image to the Engine's artwork
memory (a vision model describes it so "make it like the March creative" means
something), loads a brand kit and teaches the Engine a list of standing
corrections. Nothing touches the git vault: confidential material goes
straight to the Mind. A state file in the folder remembers what has been
filed, so re-running only picks up what is new or changed.

A voice pack is a folder holding any of:
  brand-kit.json     -> POST /brand/kit   (voice, rules, campaigns, facts, banned terms, platforms, segments, people)
  fixes.json         -> POST /engine/fix  (a list of {task, scope, wrong, right, why, rule}; rules already in force are skipped)
  *.md with a frontmatter block (kind:, title:, campaign:, platform:) -> /mind/ingest with that kind
  anything else      -> filed as before (kind guessed from the path)

Usage (on the Mac, from the repo):
  python3 tools/engine-ingest.py ~/Exports/MCA --ns mca --key $AXIOM_KEY
  python3 tools/engine-ingest.py ~/Downloads/mca-voice-pack --ns mca --key $AXIOM_KEY
  python3 tools/engine-ingest.py ~/Exports/MCA --ns mca --key $AXIOM_KEY --kinds artwork   # images only
  python3 tools/engine-ingest.py ~/Exports/MCA --ns mca --dry-run                            # list what would be filed

Text: .txt .md .html .htm .csv .json .docx (native), .pdf when `pdftotext` is on
PATH (brew install poppler). Images: .png .jpg .jpeg .webp (6 MB cap). Anything
else is listed as skipped so you can see what did not go in.
"""
import argparse, base64, datetime, hashlib, html, importlib.util, json, os, re, shutil, subprocess, sys, time, urllib.error, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('reach_reddit', os.path.join(HERE, 'reach-reddit.py'))
rr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rr)
WORKER = rr.WORKER
STATE = '.axiom-ingest-state.json'
TEXT_EXT = {'.txt', '.md', '.markdown', '.html', '.htm', '.csv', '.json', '.docx', '.pdf'}
IMAGE_EXT = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}
MAX_TEXT = 180000
MAX_IMAGE = 6 * 1024 * 1024
KIT_RX = re.compile(r'(^|[-_])brand[-_]?kit\.json$', re.I)
FIXES_RX = re.compile(r'(^|[-_])fixes\.json$', re.I)
KINDS_ORDER = {'kit': 0, 'fixes': 1, 'doc': 2, 'artwork': 3}


def http(url, key=None, body=None, timeout=60):
    """The worker answers an error with a JSON body that names the reason; keep it
    instead of the bare 'HTTP Error 500' urllib would raise."""
    try:
        return rr.http_json(url, key, body, timeout=timeout)
    except urllib.error.HTTPError as e:
        try:
            d = json.loads(e.read().decode() or '{}')
        except Exception:
            d = {}
        if not isinstance(d, dict) or not d.get('error'):
            d = {'error': 'HTTP %s' % e.code, 'detail': str(e.reason or '')[:160]}
        return d


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def read_docx(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf8', 'ignore')
    xml = re.sub(r'</w:p>', '\n', xml)
    return html.unescape(re.sub(r'<[^>]+>', '', xml))


def read_pdf(path):
    if not shutil.which('pdftotext'):
        raise RuntimeError('pdftotext not installed (brew install poppler)')
    p = subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, timeout=120)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or 'pdftotext failed').strip()[:160])
    return p.stdout


def frontmatter(txt):
    """A leading `---` block of `key: value` lines. Returns (meta, body)."""
    m = re.match(r'^---\s*\n(.*?)\n---\s*\n?', txt, flags=re.S)
    if not m:
        return {}, txt
    meta = {}
    for line in m.group(1).splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            meta[k.strip().lower()] = v.strip()
    return meta, txt[m.end():]


def read_text(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.docx': return read_docx(path)
    if ext == '.pdf': return read_pdf(path)
    with open(path, 'rb') as f:
        raw = f.read()
    txt = raw.decode('utf8', 'ignore')
    if ext in ('.html', '.htm'):
        txt = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', txt, flags=re.S | re.I)
        txt = html.unescape(re.sub(r'<[^>]+>', ' ', txt))
    return re.sub(r'[ \t]+\n', '\n', re.sub(r'\n{3,}', '\n\n', txt)).strip()


def guess_kind(rel):
    r = rel.lower()
    if re.search(r'release|media[-_ ]?statement|\bmr\b', r): return 'release'
    if re.search(r'brief|strategy|plan|guide', r): return 'brief'
    if re.search(r'slack|chat|thread', r): return 'slack'
    if re.search(r'copy|caption|post|exemplar', r): return 'copy'
    return 'doc'


def date_from(rel, path):
    m = re.search(r'(20\d\d)[-_/.]?(\d\d)[-_/.]?(\d\d)?', rel)
    if m:
        return '%s-%s-%s' % (m.group(1), m.group(2), m.group(3) or '01')
    return datetime.datetime.fromtimestamp(os.path.getmtime(path), datetime.timezone.utc).strftime('%Y-%m-%d')


def classify(f, kinds):
    ext = os.path.splitext(f)[1].lower()
    if KIT_RX.search(f) and 'kit' in kinds: return 'kit'
    if FIXES_RX.search(f) and 'fixes' in kinds: return 'fixes'
    if ext in TEXT_EXT and 'doc' in kinds: return 'doc'
    if ext in IMAGE_EXT and 'artwork' in kinds: return 'artwork'
    return 'skip'


def walk(folder, kinds):
    out = []
    for root, dirs, files in os.walk(folder):
        dirs[:] = [d for d in sorted(dirs) if not d.startswith('.')]
        for f in sorted(files):
            if f.startswith('.'): continue
            # a pack's README explains the folder to a person; it is not client knowledge
            if root == folder and f.lower().startswith('readme'): continue
            path = os.path.join(root, f)
            rel = os.path.relpath(path, folder)
            out.append((classify(f, kinds), path, rel))
    # the kit first (the Desk writes from it), then the rules, then the documents
    out.sort(key=lambda t: (KINDS_ORDER.get(t[0], 9), t[2]))
    return out


def load_state(folder):
    try:
        with open(os.path.join(folder, STATE)) as f: return json.load(f)
    except Exception:
        return {}


def save_state(folder, state):
    with open(os.path.join(folder, STATE), 'w') as f: json.dump(state, f, indent=1)


def file_doc(worker, key, ns, path, rel):
    text = read_text(path)
    meta = {}
    if os.path.splitext(path)[1].lower() in ('.md', '.markdown'):
        meta, text = frontmatter(text)
    if len(text.strip()) < 40: raise RuntimeError('no readable text')
    title = (meta.get('title') or os.path.splitext(os.path.basename(rel))[0].replace('_', ' ').replace('-', ' ').strip())[:200]
    kind = re.sub(r'[^a-z_]', '', (meta.get('kind') or '').lower())[:40] or guess_kind(rel)
    tags = ':'.join(x for x in [ns, re.sub(r'[^a-z0-9_-]', '', (meta.get('campaign') or '').lower())[:24], re.sub(r'[^a-z0-9_, -]', '', (meta.get('platform') or '').lower())[:60]] if x)
    body = {'namespace': ns, 'title': title, 'text': text[:MAX_TEXT], 'kind': kind, 'source': ('pack:' + tags + ':' if meta else 'ingest:') + rel[:240], 'date': date_from(rel, path)}
    d = http(worker.rstrip('/') + '/mind/ingest', key, body, timeout=120)
    if d.get('error'): raise RuntimeError('%s %s' % (d.get('error'), d.get('detail', '')))
    return {'docId': d.get('docId', ''), 'chunks': d.get('chunks', 0), 'kind': body['kind'], 'chars': len(text)}


def file_artwork(worker, key, ns, path, rel, mind_ns=None):
    size = os.path.getsize(path)
    if size > MAX_IMAGE: raise RuntimeError('larger than 6 MB')
    with open(path, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    mime = IMAGE_EXT[os.path.splitext(path)[1].lower()]
    parts = rel.split(os.sep)
    meta = {'path': rel[:280], 'date': date_from(rel, path), 'campaign': parts[-2] if len(parts) > 1 else ''}
    title = os.path.splitext(os.path.basename(rel))[0].replace('_', ' ').replace('-', ' ').strip()[:200]
    body = {'ns': ns, 'title': title, 'imageB64': b64, 'mime': mime, 'meta': meta}
    if mind_ns and mind_ns != ns: body['mindNs'] = mind_ns
    d = http(worker.rstrip('/') + '/engine/artwork', key, body, timeout=180)
    if d.get('error'): raise RuntimeError('%s %s' % (d.get('error'), d.get('detail', '')))
    a = d.get('artwork') or {}
    return {'id': a.get('id', ''), 'description': (a.get('description') or '')[:120], 'described': a.get('described', True), 'warning': (d.get('warning') or '')[:200]}


def file_kit(worker, key, ns, path, rel):
    """brand-kit.json -> POST /brand/kit. The palette, fonts and logo are only
    touched if the file carries them, so a kit set in the app is kept."""
    with open(path, 'rb') as f:
        kit = json.loads(f.read().decode('utf8', 'ignore'))
    if not isinstance(kit, dict): raise RuntimeError('brand-kit.json must hold one object')
    body = {k: v for k, v in kit.items() if k not in ('ns', 'logoB64', 'logoMime', 'removeLogo')}
    body['ns'] = ns
    d = http(worker.rstrip('/') + '/brand/kit', key, body, timeout=120)
    if d.get('error'): raise RuntimeError('%s %s' % (d.get('error'), d.get('detail', '')))
    k = d.get('kit') or {}
    return {'campaigns': len(k.get('campaigns') or []), 'facts': len(k.get('facts') or []), 'banned': len(k.get('banned') or []), 'voice': len(k.get('voice') or ''), 'rules': len(k.get('rules') or '')}


def file_fixes(worker, key, ns, path, rel, pace=0.3):
    """fixes.json -> one POST /engine/fix per correction. A rule that is already
    in force for the namespace (same wording) is skipped, so re-runs after an
    edit only add what is new."""
    with open(path, 'rb') as f:
        fixes = json.loads(f.read().decode('utf8', 'ignore'))
    if not isinstance(fixes, list): raise RuntimeError('fixes.json must hold a list')
    have = set()
    try:
        cur = http(worker.rstrip('/') + '/engine/fixes?ns=%s&all=1' % ns, key, None, timeout=60)
        for fx in cur.get('fixes') or []:
            have.add((fx.get('rule') or '').strip().lower())
    except Exception:
        pass
    added = skipped = 0
    src = 'voice-pack:' + os.path.basename(rel)[:60]
    for fx in fixes:
        if not isinstance(fx, dict): continue
        rule = (fx.get('rule') or '').strip()
        if rule and rule.lower() in have:
            skipped += 1; continue
        body = {'ns': ns, 'task': fx.get('task') or 'copy', 'scope': fx.get('scope') or 'client', 'wrong': fx.get('wrong') or '', 'right': fx.get('right') or '',
                'why': fx.get('why') or '', 'source': fx.get('source') or src}
        if rule: body['rule'] = rule; body['exemplar'] = fx.get('exemplar') or fx.get('right') or ''
        d = http(worker.rstrip('/') + '/engine/fix', key, body, timeout=90)
        if d.get('error'): raise RuntimeError('%s %s' % (d.get('error'), d.get('detail', '')))
        added += 1
        if rule: have.add(rule.lower())
        time.sleep(pace)
    return {'added': added, 'already': skipped, 'total': len(fixes)}


def describe(kind, res):
    if kind == 'artwork': return ' - ' + (('STORED, NOT DESCRIBED: ' + res['warning']) if res.get('warning') else res['description'])
    if kind == 'kit': return ' - %d campaigns, %d facts, %d banned terms, voice %d chars, rules %d chars' % (res['campaigns'], res['facts'], res['banned'], res['voice'], res['rules'])
    if kind == 'fixes': return ' - %d rules taught, %d already in force' % (res['added'], res['already'])
    return ' - %s, %d chars, %d chunks' % (res['kind'], res['chars'], res['chunks'])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('folder')
    ap.add_argument('--ns', required=True, help='client namespace: mca, aep, vicnats, pca, mba, pharm, cmm')
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--mind-ns', default='', help="namespace the documents are filed under when it differs from --ns: '<ns>_creative' is the creative shelf that only the Content Desk, Release Desk, Ad Lab and Studio retrieve (the kit, rules and artwork still go to --ns)")
    ap.add_argument('--worker', default=WORKER)
    ap.add_argument('--kinds', default='kit,fixes,doc,artwork', help='what to file: kit, fixes, doc, artwork (comma-separated)')
    ap.add_argument('--max', type=int, default=0, help='stop after this many files (0 = all)')
    ap.add_argument('--pace', type=float, default=0.4, help='seconds between files')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--force', action='store_true', help='re-file everything, ignoring the state file')
    a = ap.parse_args(argv)
    folder = os.path.abspath(a.folder)
    if not os.path.isdir(folder): sys.exit('not a folder: ' + folder)
    if not a.key and not a.dry_run: sys.exit('need --key or AXIOM_KEY')
    ns = re.sub(r'[^a-z0-9_-]', '', a.ns.lower())[:24] or 'cmm'
    mns = re.sub(r'[^a-z0-9_-]', '', (a.mind_ns or a.ns).lower())[:32] or ns
    if mns != ns and not mns.startswith(ns + '_'): sys.exit('--mind-ns must be the client namespace or a shelf of it, such as %s_creative' % ns)
    kinds = [k.strip() for k in a.kinds.split(',') if k.strip()]
    state = {} if a.force else load_state(folder)
    items = walk(folder, kinds)
    todo = [(k, p, r) for k, p, r in items if k != 'skip']
    skipped = [r for k, p, r in items if k == 'skip']
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    n = lambda kind: sum(1 for k, _, _ in todo if k == kind)
    print('%s  %s: %d documents%s, %d images, %s%s%d other files in %s' % (stamp, ns, n('doc'), (' -> ' + mns) if mns != ns else '', n('artwork'), '1 brand kit, ' if n('kit') else '', '1 fixes list, ' if n('fixes') else '', len(skipped), folder))
    if skipped[:5]: print('  not filed (type not handled): ' + ', '.join(skipped[:5]) + (' ...' if len(skipped) > 5 else ''))
    done = failed = same = 0
    for i, (kind, path, rel) in enumerate(todo):
        if a.max and done + failed >= a.max: break
        h = sha(path)
        if not a.force and state.get(rel, {}).get('sha') == h:
            same += 1; continue
        if a.dry_run:
            print('  would file %-8s %s' % (kind, rel)); done += 1; continue
        try:
            if kind == 'kit': res = file_kit(a.worker, a.key, ns, path, rel)
            elif kind == 'fixes': res = file_fixes(a.worker, a.key, ns, path, rel)
            elif kind == 'doc': res = file_doc(a.worker, a.key, mns, path, rel)
            else: res = file_artwork(a.worker, a.key, ns, path, rel, mns)
            state[rel] = {'sha': h, 'kind': kind, 'filed': stamp, 'result': res}
            save_state(folder, state)
            done += 1
            print('  filed %-8s %s%s' % (kind, rel, describe(kind, res)))
        except Exception as e:
            failed += 1
            print('  FAILED %-7s %s - %s' % (kind, rel, str(e)[:160]), file=sys.stderr)
            if 'HTTP 401' in str(e) or 'HTTP 403' in str(e): sys.exit('AXIOM refused the key; use a full-access key')
        time.sleep(a.pace)
    print('%s  %s: %d filed, %d unchanged since last run, %d failed' % (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), ns, done, same, failed))
    return 1 if failed and not done else 0


if __name__ == '__main__':
    sys.exit(main())
