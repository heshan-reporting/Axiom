#!/usr/bin/env python3
"""
engine-ingest.py - feed a client's past work into the Engine's memory.

Point it at a folder of exports (Drive, Slack, past releases, approved tiles,
ads) and it walks everything, files the documents in the Mind under the
client's namespace, and hands every image to the Engine's artwork memory,
where a vision model describes it so "make it like the March creative" means
something. Nothing touches the git vault: confidential material goes straight
to the Mind. A state file in the folder remembers what has been filed, so
re-running only picks up what is new or changed.

Usage (on the Mac, from the repo):
  python3 tools/engine-ingest.py ~/Exports/MCA --ns mca --key $AXIOM_KEY
  python3 tools/engine-ingest.py ~/Exports/MCA --ns mca --key $AXIOM_KEY --kinds artwork   # images only
  python3 tools/engine-ingest.py ~/Exports/MCA --ns mca --dry-run                            # list what would be filed

Text: .txt .md .html .htm .csv .json .docx (native), .pdf when `pdftotext` is on
PATH (brew install poppler). Images: .png .jpg .jpeg .webp (6 MB cap). Anything
else is listed as skipped so you can see what did not go in.
"""
import argparse, base64, datetime, hashlib, html, importlib.util, json, os, re, shutil, subprocess, sys, time, zipfile

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
    if re.search(r'brief|strategy|plan', r): return 'brief'
    if re.search(r'slack|chat|thread', r): return 'slack'
    if re.search(r'copy|caption|post', r): return 'copy'
    return 'doc'


def date_from(rel, path):
    m = re.search(r'(20\d\d)[-_/.]?(\d\d)[-_/.]?(\d\d)?', rel)
    if m:
        return '%s-%s-%s' % (m.group(1), m.group(2), m.group(3) or '01')
    return datetime.datetime.fromtimestamp(os.path.getmtime(path), datetime.timezone.utc).strftime('%Y-%m-%d')


def walk(folder, kinds):
    out = []
    for root, dirs, files in os.walk(folder):
        dirs[:] = [d for d in sorted(dirs) if not d.startswith('.')]
        for f in sorted(files):
            if f.startswith('.'): continue
            path = os.path.join(root, f)
            rel = os.path.relpath(path, folder)
            ext = os.path.splitext(f)[1].lower()
            if ext in TEXT_EXT and 'doc' in kinds: out.append(('doc', path, rel))
            elif ext in IMAGE_EXT and 'artwork' in kinds: out.append(('artwork', path, rel))
            else: out.append(('skip', path, rel))
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
    if len(text.strip()) < 40: raise RuntimeError('no readable text')
    title = os.path.splitext(os.path.basename(rel))[0].replace('_', ' ').replace('-', ' ').strip()[:200]
    body = {'namespace': ns, 'title': title, 'text': text[:MAX_TEXT], 'kind': guess_kind(rel), 'source': 'ingest:' + rel[:280], 'date': date_from(rel, path)}
    d = rr.http_json(worker.rstrip('/') + '/mind/ingest', key, body, timeout=120)
    if d.get('error'): raise RuntimeError('%s %s' % (d.get('error'), d.get('detail', '')))
    return {'docId': d.get('docId', ''), 'chunks': d.get('chunks', 0), 'kind': body['kind'], 'chars': len(text)}


def file_artwork(worker, key, ns, path, rel):
    size = os.path.getsize(path)
    if size > MAX_IMAGE: raise RuntimeError('larger than 6 MB')
    with open(path, 'rb') as f: b64 = base64.b64encode(f.read()).decode()
    mime = IMAGE_EXT[os.path.splitext(path)[1].lower()]
    parts = rel.split(os.sep)
    meta = {'path': rel[:280], 'date': date_from(rel, path), 'campaign': parts[-2] if len(parts) > 1 else ''}
    title = os.path.splitext(os.path.basename(rel))[0].replace('_', ' ').replace('-', ' ').strip()[:200]
    d = rr.http_json(worker.rstrip('/') + '/engine/artwork', key, {'ns': ns, 'title': title, 'imageB64': b64, 'mime': mime, 'meta': meta}, timeout=180)
    if d.get('error'): raise RuntimeError('%s %s' % (d.get('error'), d.get('detail', '')))
    a = d.get('artwork') or {}
    return {'id': a.get('id', ''), 'description': (a.get('description') or '')[:120]}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('folder')
    ap.add_argument('--ns', required=True, help='client namespace: mca, aep, vicnats, pca, mba, pharm, cmm')
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--worker', default=WORKER)
    ap.add_argument('--kinds', default='doc,artwork', help='what to file: doc, artwork, or both')
    ap.add_argument('--max', type=int, default=0, help='stop after this many files (0 = all)')
    ap.add_argument('--pace', type=float, default=0.4, help='seconds between files')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--force', action='store_true', help='re-file everything, ignoring the state file')
    a = ap.parse_args(argv)
    folder = os.path.abspath(a.folder)
    if not os.path.isdir(folder): sys.exit('not a folder: ' + folder)
    if not a.key and not a.dry_run: sys.exit('need --key or AXIOM_KEY')
    ns = re.sub(r'[^a-z0-9_-]', '', a.ns.lower())[:24] or 'cmm'
    kinds = [k.strip() for k in a.kinds.split(',') if k.strip()]
    state = {} if a.force else load_state(folder)
    items = walk(folder, kinds)
    todo = [(k, p, r) for k, p, r in items if k != 'skip']
    skipped = [r for k, p, r in items if k == 'skip']
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    print('%s  %s: %d documents, %d images, %d other files in %s' % (stamp, ns, sum(1 for k, _, _ in todo if k == 'doc'), sum(1 for k, _, _ in todo if k == 'artwork'), len(skipped), folder))
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
            res = file_doc(a.worker, a.key, ns, path, rel) if kind == 'doc' else file_artwork(a.worker, a.key, ns, path, rel)
            state[rel] = {'sha': h, 'kind': kind, 'filed': stamp, 'result': res}
            save_state(folder, state)
            done += 1
            print('  filed %-8s %s%s' % (kind, rel, (' - ' + res['description']) if kind == 'artwork' else (' - %d chars, %d chunks' % (res['chars'], res['chunks']))))
        except Exception as e:
            failed += 1
            print('  FAILED %-7s %s - %s' % (kind, rel, str(e)[:160]), file=sys.stderr)
            if 'HTTP 401' in str(e) or 'HTTP 403' in str(e): sys.exit('AXIOM refused the key; use a full-access key')
        time.sleep(a.pace)
    print('%s  %s: %d filed, %d unchanged since last run, %d failed' % (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), ns, done, same, failed))
    return 1 if failed and not done else 0


if __name__ == '__main__':
    sys.exit(main())
