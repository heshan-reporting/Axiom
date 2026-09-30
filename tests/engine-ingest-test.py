#!/usr/bin/env python3
"""engine-ingest.py voice-pack cases: the kit goes first, then the rules
(deduped against what is in force), then the documents with frontmatter kinds;
the state file makes the second run a no-op; dry-run lists without posting."""
import importlib.util, io, json, os, sys, tempfile, contextlib, urllib.error

spec = importlib.util.spec_from_file_location('engine_ingest', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools', 'engine-ingest.py'))
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

calls = []
def fake_http(url, key=None, body=None, timeout=60):
    calls.append((url.split('workers.dev')[-1], body))
    if url.endswith('/engine/fixes?ns=mca&all=1'): return {'ok': True, 'fixes': [{'rule': "Write 'Minerals Council' with the plural - never 'Mineral Council'.", 'active': True}]}
    if url.endswith('/brand/kit'): return {'ok': True, 'kit': {'campaigns': body.get('campaigns', []), 'facts': body.get('facts', []), 'banned': body.get('banned', []), 'voice': body.get('voice', ''), 'rules': body.get('rules', '')}}
    if url.endswith('/engine/fix'): return {'ok': True, 'fix': {'id': 'f' + str(len(calls))}}
    if url.endswith('/mind/ingest'): return {'ok': True, 'docId': 'd' + str(len(calls)), 'chunks': 1}
    if url.endswith('/engine/artwork'):
        if (body or {}).get('title') == 'quota fail': raise urllib.error.HTTPError(url, 502, 'Bad Gateway', {}, io.BytesIO(b'{"ok":false,"error":"describe_failed","detail":"describe_failed: Resource has been exhausted"}'))
        if (body or {}).get('title') == 'stored only': return {'ok': True, 'warning': 'stored, but not described: quota. POST /engine/artwork/describe {id} retries.', 'artwork': {'id': 'a2', 'described': False, 'description': '[not yet described] stored only'}}
        return {'ok': True, 'artwork': {'id': 'a1', 'description': 'an orange tile', 'described': True}}
    return {'ok': True}
mod.rr.http_json = fake_http

pack = tempfile.mkdtemp()
os.makedirs(os.path.join(pack, 'exemplars')); os.makedirs(os.path.join(pack, 'guide'))
json.dump({'ns': 'mca', 'name': 'Minerals Council of Australia', 'voice': 'Plain.', 'rules': 'ALWAYS mining.', 'campaigns': [{'id': 'hoof', 'name': 'Hands Off Our Fuel'}], 'facts': [{'id': 'tax74', 'text': '$74 billion'}], 'banned': [{'term': 'subsidy'}], 'logoB64': 'SHOULDNOTGO'}, open(os.path.join(pack, 'brand-kit.json'), 'w'))
json.dump([{'task': 'copy', 'scope': 'client', 'wrong': 'Mineral Council', 'right': 'Minerals Council', 'why': 'Dee', 'rule': "Write 'Minerals Council' with the plural - never 'Mineral Council'."},
           {'task': 'copy', 'scope': 'client', 'wrong': 'CEO, Tania', 'right': 'CEO Tania', 'why': 'Dee', 'rule': 'No comma between a title and a name.'}], open(os.path.join(pack, 'fixes.json'), 'w'))
open(os.path.join(pack, 'exemplars', 'copy-hoof.md'), 'w').write('---\nkind: copy\ntitle: Hands Off Our Fuel - approved captions\ncampaign: hoof\nplatform: facebook, instagram\n---\n\nFuel Tax Credits are not a subsidy. They stop businesses paying a road tax on fuel used off public roads.\n\nHands Off Our Fuel.\n')
open(os.path.join(pack, 'guide', 'brief-guide.md'), 'w').write('---\nkind: brief\ntitle: MCA content guide\n---\n\nThe shape of an MCA caption: a hook, the figure and what it funds, the sign-off, the link line, the source line.\n')
open(os.path.join(pack, 'notes.txt'), 'w').write('Some plain notes about the campaign that are long enough to be filed as a document in the Mind.\n')
open(os.path.join(pack, 'weird.xyz'), 'w').write('x')

passed = failed = 0
def t(name, cond, detail=''):
    global passed, failed
    if cond: passed += 1; print('  ok   ' + name)
    else: failed += 1; print('  FAIL ' + name + (' - ' + str(detail)[:300] if detail else ''))

print('engine-ingest voice-pack cases')
out = io.StringIO()
with contextlib.redirect_stdout(out):
    rc = mod.main([pack, '--ns', 'mca', '--key', 'k', '--pace', '0'])
text = out.getvalue()
paths = [c[0] for c in calls]
t('exit code 0', rc == 0, rc)
t('the kit is posted first, without the ns/logo fields, ns forced to the namespace', paths[0] == '/brand/kit' and calls[0][1]['ns'] == 'mca' and 'logoB64' not in calls[0][1] and calls[0][1]['campaigns'][0]['id'] == 'hoof', calls[0])
t('the rules in force are read before teaching', paths[1] == '/engine/fixes?ns=mca&all=1', paths)
fixposts = [c for c in calls if c[0] == '/engine/fix']
t('one rule taught, the one already in force skipped', len(fixposts) == 1 and fixposts[0][1]['rule'] == 'No comma between a title and a name.' and fixposts[0][1]['task'] == 'copy' and fixposts[0][1]['scope'] == 'client' and fixposts[0][1]['source'] == 'voice-pack:fixes.json', fixposts)
t('the fixes summary says so', '1 rules taught, 1 already in force' in text, text)
docs = [c[1] for c in calls if c[0] == '/mind/ingest']
t('three documents filed', len(docs) == 3, [d['title'] for d in docs])
ex = next((d for d in docs if d['kind'] == 'copy'), None)
t('frontmatter drives kind, title and source tags for the exemplar', ex and ex['title'] == 'Hands Off Our Fuel - approved captions' and ex['source'].startswith('pack:mca:hoof:facebook, instagram:exemplars/copy-hoof.md') and not ex['text'].startswith('---') and 'Hands Off Our Fuel.' in ex['text'], ex)
guide = next((d for d in docs if d['kind'] == 'brief'), None)
t('the guide is filed as kind brief from its frontmatter', guide and guide['title'] == 'MCA content guide', guide)
notes = next((d for d in docs if d['title'] == 'notes'), None)
t('a plain text file is still filed as a doc with an ingest: source', notes and notes['kind'] == 'doc' and notes['source'].startswith('ingest:notes.txt'), notes)
t('the kit and the fixes come before the documents', paths.index('/brand/kit') < paths.index('/mind/ingest') and paths.index('/engine/fix') < paths.index('/mind/ingest'), paths)
t('the odd file is listed as not filed', 'weird.xyz' in text, text)
t('the header counts the kit and the fixes list', '1 brand kit, 1 fixes list' in text, text)
state = json.load(open(os.path.join(pack, mod.STATE)))
t('the state file remembers all five', len(state) == 5 and state['brand-kit.json']['kind'] == 'kit' and state['fixes.json']['result']['added'] == 1, state.keys())

calls.clear(); out = io.StringIO()
with contextlib.redirect_stdout(out):
    rc2 = mod.main([pack, '--ns', 'mca', '--key', 'k', '--pace', '0'])
t('a second run posts nothing and reports 5 unchanged', rc2 == 0 and not calls and '0 filed, 5 unchanged' in out.getvalue(), out.getvalue())

calls.clear(); out = io.StringIO()
with contextlib.redirect_stdout(out):
    rc3 = mod.main([pack, '--ns', 'mca', '--dry-run', '--force'])
t('dry-run lists every file without posting', rc3 == 0 and not calls and 'would file kit' in out.getvalue() and 'would file fixes' in out.getvalue() and out.getvalue().count('would file doc') == 3, out.getvalue())

calls.clear(); out = io.StringIO()
with contextlib.redirect_stdout(out):
    mod.main([pack, '--ns', 'mca', '--key', 'k', '--pace', '0', '--force', '--kinds', 'fixes'])
t('--kinds fixes teaches the rules only', [c[0] for c in calls] == ['/engine/fixes?ns=mca&all=1', '/engine/fix'], calls)


# -- artwork: the worker's reason is kept, a stored-but-undescribed image is reported, the Mind document goes to the shelf --
pack2 = tempfile.mkdtemp(); os.makedirs(os.path.join(pack2, 'art'))
PNG = bytes.fromhex('89504e470d0a1a0a') + b'\0' * 120
for name in ('quota-fail', 'stored-only', 'fine'): open(os.path.join(pack2, 'art', name + '.png'), 'wb').write(PNG)
calls.clear(); out = io.StringIO(); err = io.StringIO()
with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
    rc4 = mod.main([pack2, '--ns', 'mca', '--mind-ns', 'mca_creative', '--key', 'k', '--pace', '0'])
text = out.getvalue() + err.getvalue()
t('a worker error body is surfaced, not a bare HTTP code', rc4 == 0 and 'FAILED artwork art/quota-fail.png - describe_failed describe_failed: Resource has been exhausted' in text, text)
t('an artwork stored without a description is reported as such, not as filed cleanly', 'STORED, NOT DESCRIBED: stored, but not described: quota' in text, text)
t('a described artwork prints its description', 'filed artwork  art/fine.png - an orange tile' in text, text)
arts = [c[1] for c in calls if c[0] == '/engine/artwork']
t('artwork uploads carry the shelf for their Mind document and the campaign from the folder', len(arts) == 3 and all(a['mindNs'] == 'mca_creative' and a['meta']['campaign'] == 'art' for a in arts), arts and {k: v for k, v in arts[0].items() if k != 'imageB64'})
state2 = json.load(open(os.path.join(pack2, mod.STATE)))
t('the failed image is not remembered, so the next run retries it', set(state2) == {'art/stored-only.png', 'art/fine.png'}, list(state2))
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
sys.exit(1 if failed else 0)
