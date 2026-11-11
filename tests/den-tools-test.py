#!/usr/bin/env python3
"""The monitoring desk's Mac-side tools (release 2): the permalink mirror held to the worker's cases, the Supermetrics
converter (shapes, the register tie, no names, one post once, batches, a refused push) and the day's query plan (the
hashtag allowance). No network: the sender is a stand-in. Every page, post and person here is invented."""
import os, sys, json, importlib.util, tempfile

HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.join(HERE, '..', 'tools'); sys.path.insert(0, TOOLS)
def load(name, fn):
    spec = importlib.util.spec_from_file_location(name, os.path.join(TOOLS, fn)); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
perm = load('den_permalink', 'den_permalink.py'); conv = load('sm2sig', 'supermetrics2signals.py'); plan = load('pullplan', 'den-pull-plan.py')

passed = failed = 0
def t(name, cond, detail=''):
    global passed, failed
    if cond: passed += 1; print('  ok   ' + name)
    else: failed += 1; print('  FAIL ' + name + (' - ' + str(detail)[:400] if detail else ''))

print('monitoring desk tools')
cases = json.load(open(os.path.join(HERE, 'fixtures', 'den', 'permalinks.json')))['cases']
bad = [(c['platform'], c['in'], perm.canon_permalink(c['platform'], c['in']), c['out']) for c in cases if perm.canon_permalink(c['platform'], c['in']) != c['out']]
t('the permalink mirror gives the worker\'s answer on all %d shared cases' % len(cases), not bad, bad[:2])

tmp = tempfile.mkdtemp()
def sm(name, ids, rows):
    """A saved Supermetrics result in the layout the session writes: a header row of display names, then the rows."""
    p = os.path.join(tmp, name); json.dump({'success': True, 'data': {'requested_field_ids': ids, 'data': [[i.title() for i in ids]] + rows}}, open(p, 'w')); return p

FB = sm('fb.json', ['link', 'name', 'from_name', 'post_id', 'created_time', 'permalink_url', 'message', 'reactions_count', 'reactions_love', 'reactions_wow', 'reactions_haha', 'reactions_sad', 'reactions_angry', 'likes_count', 'comments_count', 'shares_count'], [
    ['https://www.facebook.com/HarbourWatch/', 'Harbour Watch', 'Jo Citizen', '108000000000001_990000000000002', '2026-11-10T02:00:00+0000', 'https://www.facebook.com/harbourwatch/posts/pfbid0abc', 'Sign the gas export tax petition', 340, 20, 2, 1, 0, 3, 300, 25, 12],
    ['https://www.facebook.com/baykeepers', 'Bay Keepers', 'Sam Private', '108000000000009_990000000000005', '2026-11-10T03:00:00+0000', '', 'Windfall tax now', 12, 0, 0, 0, 0, 0, 12, 1, 0],
    ['https://www.facebook.com/harbourwatch', 'Harbour Watch', 'Jo Citizen', '108000000000001_990000000000003', '2026-11-10T04:00:00+0000', '', '', 5, 0, 0, 0, 0, 0, 5, 0, 0],
    ['https://www.facebook.com/harbourwatch', 'Harbour Watch', 'Jo Citizen', 'not-an-id', '2026-11-10T04:00:00+0000', 'https://www.facebook.com/harbourwatch', 'An account page is not a post', 5, 0, 0, 0, 0, 0, 5, 0, 0]])
IG = sm('ig.json', ['username', 'name', 'post_id', 'post_timestamp', 'post_type', 'post_permalink', 'post_caption', 'post_likes', 'post_comments', 'post_views'], [
    ['Harbour.Watch', 'Harbour Watch', '1', '2026-11-10T05:00:00+0000', 'VIDEO', 'https://www.instagram.com/reel/DAbCdEfGhI3/?igsh=x', 'A gas export tax would fund hospitals', 900, 40, 15000],
    ['someone.else', 'Sam Private', '2', '2026-11-10T06:00:00+0000', 'IMAGE', 'https://www.instagram.com/p/DAbCdEfGhI4/', 'Gas export tax now', 5, 0, 0]])
IGH = sm('igh.json', ['hashtag_name', 'post_id', 'post_timestamp', 'post_type', 'post_permalink', 'post_caption', 'post_likes', 'post_comments'], [
    ['SaveTheFerry', '3', '2026-11-10T07:00:00+0000', 'IMAGE', 'https://www.instagram.com/p/DAbCdEfGhI5/', 'Stop the levy #savetheferry', 60, 4],
    ['savetheferry', '1', '2026-11-10T05:00:00+0000', 'VIDEO', 'https://www.instagram.com/p/DAbCdEfGhI3/', 'A gas export tax would fund hospitals', 950, 41]])
URLS = sm('urls.json', ['url', 'reaction_count', 'comment_count', 'share_count'], [['https://example.com.au/gas-export-tax', 420, 61, 88], ['not a url', 1, 1, 1]])
REG = {'watch': [{'id': 'w1', 'status': 'active', 'kind': 'account', 'platform': 'facebook', 'value': 'harbourwatch'}, {'id': 'w2', 'status': 'active', 'kind': 'account', 'platform': 'instagram', 'value': 'harbour.watch'},
                 {'id': 'w3', 'status': 'off', 'kind': 'account', 'platform': 'facebook', 'value': 'baykeepers'}, {'id': 'w4', 'status': 'active', 'kind': 'account', 'platform': 'x', 'value': 'harbourwatch'}]}

p = conv.build('aep', [('fbposts', FB), ('igposts', IG), ('ighash', IGH), ('urlshares', URLS)], REG, now=1794300000000)
rows = {r['url']: r for r in p['rows']}
t('the payload names its client, its layer and its route', (p['ns'], p['layer'], p['via']) == ('aep', 1, 'supermetrics'))
fb = rows.get('https://www.facebook.com/108000000000001/posts/990000000000002')
t('a Facebook post is filed under its numeric address, not the opaque one', bool(fb), list(rows))
t('with its counts and the time they were read', fb and fb['eng'] == {'likes': 340, 'comments': 25, 'shares': 12, 'reactions': {'love': 20, 'wow': 2, 'haha': 1, 'sad': 0, 'angry': 3}} and fb['eng_at'] == 1794300000000 and fb['ts'] == 1794276000000, fb)
t('a post from a registered page carries the register row', fb and fb.get('watch') == 'w1')
t('a page that is switched off in the register is not tied to it', 'watch' not in rows['https://www.facebook.com/108000000000009/posts/990000000000005'])
t('a post with no words and an account page are left out', len([u for u in rows if 'facebook' in u]) == 2, [u for u in rows if 'facebook' in u])
ig = rows.get('https://www.instagram.com/p/DAbCdEfGhI3/')
t('an Instagram reel and its /p/ form are one post, tied to the registered account whatever the case of the handle', bool(ig) and ig.get('watch') == 'w2', ig)
t('found again under a hashtag it keeps the account, gains the hashtag and takes the later counts', bool(ig) and ig.get('hashtag') == 'savetheferry' and ig['eng']['likes'] == 950 and ig['eng']['comments'] == 41, ig)
t('the same post in two files is one row', len(p['rows']) == 5, len(p['rows']))
t('a hashtag hit records the hashtag and no account', rows['https://www.instagram.com/p/DAbCdEfGhI5/'].get('hashtag') == 'savetheferry' and 'watch' not in rows['https://www.instagram.com/p/DAbCdEfGhI5/'])
blob = json.dumps(p)
t('nothing that names a person or a page is in the payload', not any(n in blob for n in ('Jo Citizen', 'Sam Private', 'Harbour Watch', 'Bay Keepers', 'someone.else', 'from_name')), blob[:200])
t('reach figures: a real address kept, a non-address dropped', p['fb'] == [{'url': 'https://example.com.au/gas-export-tax', 'reactions': 420, 'comments': 61, 'shares': 88}], p['fb'])
none = conv.build('aep', [('fbposts', FB)], {}, now=1)
t('with no register every post is untied', all('watch' not in r for r in none['rows']))

big = {'ns': 'aep', 'layer': 1, 'via': 'supermetrics', 'rows': [{'url': 'u%d' % i} for i in range(950)], 'fb': [{'url': 'f%d' % i} for i in range(3)]}
parts = list(conv.batches(big))
t('a large payload is sent in batches the worker accepts', [len(x['rows']) for x in parts] == [400, 400, 150] and [len(x['fb']) for x in parts] == [3, 0, 0] and all(len(x['rows']) + len(x['fb']) <= 500 for x in parts))
sent = []
tot = conv.push(big, 'https://worker.test/', 'k', send=lambda url, key, body: (sent.append((url, key, len(body['rows']))) or {'ok': True, 'kept': len(body['rows']), 'inserted': len(body['rows']), 'updated': 0, 'skipped': {'off_topic': 1}}), log=lambda *_: None)
t('push posts each batch to /signals/ingest with the key and sums what the worker kept', [s[0] for s in sent] == ['https://worker.test/signals/ingest'] * 3 and tot['kept'] == 950 and tot['off_topic'] == 3, (sent, tot))
try:
    conv.push(big, 'https://worker.test', 'k', send=lambda *a: {'ok': False, 'error': 'read_only', 'detail': 'A read key cannot collect.'}, log=lambda *_: None); refused = False
except RuntimeError as e:
    refused = 'read_only' in str(e) and 'cannot collect' in str(e)
t('a refusal from the worker stops the push and says why', refused)

PLAN = {'ok': True, 'ns': 'aep', 'plan': {'facebook': {'accounts': [{'value': 'harbourwatch'}, {'value': 'baykeepers'}]},
        'instagram': {'accounts': [{'value': 'harbour.watch'}], 'hashtags': [{'value': 'savetheferry'}, {'value': 'nightboat'}, {'value': 'harbourlevy'}], 'hashtagAllowance': {'used': 28, 'left': 2, 'limit': 30}}},
        'urls': ['https://example.com.au/gas-export-tax']}
qs, note = plan.queries(PLAN, 3)
by = {q['save_as']: q for q in qs}
t('the plan asks for page posts, account posts, hashtags and reach, each saved under the name the converter expects', sorted(by) == ['fbposts.json', 'ighash.json', 'igposts.json', 'urlshares.json'])
t('page posts go to Facebook Public Data with the fields the converter reads', by['fbposts.json']['ds_id'] == 'FBPD' and by['fbposts.json']['ds_accounts'] == 'harbourwatch,baykeepers' and by['fbposts.json']['settings'] == {'report_type': 'PagePosts'} and 'post_id' in by['fbposts.json']['fields'] and 'from_name' not in by['fbposts.json']['fields'])
t('only as many hashtags as the week still allows are asked for', by['ighash.json']['ds_accounts'] == 'savetheferry,nightboat' and note == {'hashtags_left': 2, 'hashtags_held_back': 1}, (by['ighash.json']['ds_accounts'], note))
spent = dict(PLAN, plan=dict(PLAN['plan'], instagram=dict(PLAN['plan']['instagram'], hashtagAllowance={'left': 0})))
t('with the allowance spent no hashtag is asked for', 'ighash.json' not in {q['save_as'] for q in plan.queries(spent)[0]})
t('an empty register asks for nothing', plan.queries({'plan': {}, 'urls': []})[0] == [])
fields_fb = set(by['fbposts.json']['fields'].split(','))
t('no field that names a person is ever requested', not (fields_fb | set(by['igposts.json']['fields'].split(','))) & {'from_name', 'from_id', 'name', 'story_tags'})

# ---- newsletters and monitoring exports ----
imp = load('den_import', 'den-import.py')
nl = tempfile.mkdtemp()
BODY = 'The Senate will vote on a gas export tax this week after the crossbench secured a debate. ' * 6
open(os.path.join(nl, 'a.eml'), 'w').write('From: Sam Private <sam.private@example.com>\nTo: team@example.com\nSubject: Morning briefing: the gas export tax vote\nDate: Tue, 10 Nov 2026 06:00:00 +1100\nContent-Type: text/html; charset=utf-8\n\n<html><body><style>p{color:red}</style><p>' + BODY + '</p><p>Unsubscribe</p></body></html>\n')
open(os.path.join(nl, 'b.eml'), 'w').write('From: x@example.com\nSubject: Too short\nDate: Tue, 10 Nov 2026 06:00:00 +1100\n\nhello\n')
open(os.path.join(nl, 'notes.txt'), 'w').write('not an email')
items = imp.from_eml(nl)
t('a saved newsletter becomes one item: its subject, its date and its words', len(items) == 1 and items[0]['title'] == 'Morning briefing: the gas export tax vote' and items[0]['ts'] == 1794250800000 and 'gas export tax' in items[0]['text'] and 'color:red' not in items[0]['text'], items[:1])
t('the sender is not read', 'Sam Private' not in json.dumps(items) and 'sam.private' not in json.dumps(items))
csvp = os.path.join(tmp, 'export.csv')
open(csvp, 'w', encoding='utf-8-sig').write('Date;Headline;Source Name;URL;Hit Sentence;Author\n2026-11-10;Greens renew call for windfall tax on gas;Regional Daily;https://example-regional.com.au/story/windfall;A windfall tax on gas companies.;Jo Citizen\n2026-11-10;No link here;Somewhere;;x;y\n')
mon = imp.from_monitor(csvp)
t('a monitoring export is read by its column names, whatever the separator', mon == [{'title': 'Greens renew call for windfall tax on gas', 'url': 'https://example-regional.com.au/story/windfall', 'ts': '2026-11-10', 'outlet': 'Regional Daily', 'text': 'A windfall tax on gas companies.'}], mon)
t('and the journalist\'s name in it is not carried', 'Jo Citizen' not in json.dumps(mon))
sent = []; said = []
r = imp.run('monitor', mon, 'aep', '', 'https://worker.test', 'k', False, send=lambda *a: sent.append(a) or {'ok': True}, out=said.append)
t('without --apply nothing is sent, and it says so', sent == [] and r == {'sent': 0} and 'nothing was sent' in said[-1])
r = imp.run('newsletter', items, 'aep', 'capitalbrief', 'https://worker.test/', 'k', True, send=lambda url, key, body: sent.append((url, body)) or {'ok': True, 'added': 1, 'held': 0, 'gated': 1, 'on_topic': 1}, out=said.append)
t('with --apply it files through /den/import under the source and says what was new', sent[0][0] == 'https://worker.test/den/import' and sent[0][1]['kind'] == 'newsletter' and sent[0][1]['source'] == 'capitalbrief' and r['added'] == 1 and '1 new to AXIOM' in said[-1] and 'text filed for the team' in said[-1], (sent[0][1].keys(), said[-1]))
try:
    imp.run('newsletter', items, 'aep', 'capitalbrief', 'https://worker.test', 'k', True, send=lambda *a: {'ok': False, 'error': 'source_not_cleared', 'detail': 'not cleared'}, out=lambda *_: None); stopped = False
except SystemExit as e:
    stopped = 'source_not_cleared' in str(e)
t('a refusal from the worker stops the import and says why', stopped)


# ---- what past reports name, proposed to the register ----
mr = load('den_mine', 'den-mine-reports.py')
rep = tempfile.mkdtemp()
PAD = 'This invented report is padded so that it is long enough to count as a report that was read. ' * 4
def report(name, body): open(os.path.join(rep, name), 'w').write(PAD + '\n' + body)
report('one.txt', 'Key Narratives\nHarbour Watch renewed its call at Kingsbay Reef. See https://x.com/harbourwatch/status/190001 and https://straitwatch.example.org/brief/1 #SaveTheStrait\nA windfall tax on gas was raised by Jo Citizen.')
report('two.md', 'Social Media Activity\nThe Kingsbay Reef decision drew posts from https://www.facebook.com/harbourwatchpage/posts/pfbid0abc and the group https://www.facebook.com/groups/straitfriends/ #savethestrait\nhttps://straitwatch.example.org/brief/2 and https://x.com/harbourwatch\nWindfall Tax debate continues.')
open(os.path.join(rep, 'three.html'), 'w').write('<html><body><p>' + PAD + '</p><h2>Source List</h2><p>Kingsbay Reef again, with <a href="https://www.instagram.com/harbourwatch_au/">their Instagram</a>, <a href="https://www.youtube.com/@harbourwatchtv">YouTube</a>, <a href="https://x.com/i/web/status/190002">a post</a> and <a href="https://www.facebook.com/groups/straitfriends/posts/55">the group</a>. Windfall Tax.</p><script>var x="https://evil.example.net/a"</script></body></html>')
import zipfile
with zipfile.ZipFile(os.path.join(rep, 'four.docx'), 'w') as z:
    z.writestr('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>' + PAD + '</w:t></w:r></w:p><w:p><w:r><w:t>Kingsbay Reef and the Harbour Watch campaign. #SaveTheStrait</w:t></w:r></w:p></w:body></w:document>')
    z.writestr('word/_rels/document.xml.rels', '<Relationships><Relationship Id="r1" Target="https://www.instagram.com/harbourwatch_au/p/Cabc/"/><Relationship Id="r2" Target="https://straitwatch.example.org/brief/4"/></Relationships>')
open(os.path.join(rep, 'empty.txt'), 'w').write('too short')
got = mr.mine(rep, 2)
has = lambda k, v: next((c['reports'] for c in got['candidates'] if c['kind'] == k and c['value'] == v), 0)
t('every kind of report is read, and one too short to be a report is named', got['reports'] == 4 and got['unread'] == ['empty.txt'], got)
t('an account is counted once a report, from a profile link or a post that names it', has('account', 'harbourwatch') == 2 and has('account', 'harbourwatch_au') == 2, got['candidates'])
t('a post address that names no profile proposes nobody', not any(c['value'] in ('i', 'web', 'p', 'groups', 'posts') for c in got['candidates']))
t('a public group, a hashtag whatever its capitals, and an outlet', has('group', 'straitfriends') == 2 and has('hashtag', 'savethestrait') == 3 and has('source', 'straitwatch.example.org') == 3, got['candidates'])
t('a platform is not an outlet, and a link inside a script is not a citation', not any(c['kind'] == 'source' and ('facebook' in c['value'] or 'x.com' == c['value'] or 'evil' in c['value']) for c in got['candidates']))
t('a name written with capitals that recurs is a term; a section heading is not', has('term', 'kingsbay reef') == 4 and not any(c['value'] in ('key narratives', 'social media activity', 'source list') for c in got['candidates']), [c for c in got['candidates'] if c['kind'] == 'term'])
t('what one report alone names is not proposed', has('account', 'harbourwatchpage') == 0 and has('account', '@harbourwatchtv') == 0)
lex = [{'ns': 'aep', 'wide': r'windfall (profits? )?tax|gas export tax', 'rx': 'x'}]
t('a term the desk already matches is left out when the lexicon is known', has('term', 'windfall tax') >= 2 and not any(c['value'] == 'windfall tax' for c in mr.mine(rep, 2, lex)['candidates']))
sent = []; said = []
r = mr.run(rep, 'aep', 'https://worker.test', '', False, send=lambda *a: sent.append(a) or {}, out=said.append)
t('without --apply nothing is sent, and it says so', sent == [] and r['sent'] == 0 and r['found'] == len(got['candidates']) and 'Nothing was sent' in said[-1] and 'lexicon was not read' in said[0])
def worker(url, key, body=None):
    sent.append((url, body))
    return {'ok': True, 'issues': lex} if url.endswith('/reddit/issues') else {'ok': True, 'proposed': len(body['items']) - 1, 'known': 1, 'refused': []}
r = mr.run(rep, 'aep', 'https://worker.test/', 'k', True, send=worker, out=said.append)
props = [b for u, b in sent if u.endswith('/den/watch/propose')]
t('with --apply the candidates are proposed as source reports, with the count and no sentence of any report', len(props) == 1 and props[0]['ns'] == 'aep' and props[0]['source'] == 'reports' and all(set(i) == {'kind', 'platform', 'value', 'score', 'reason'} and i['reason'].startswith('Named in ') for i in props[0]['items']) and 'padded' not in json.dumps(props) and r['known'] == 1 and 'already in its register' in said[-1], props[:1])
try:
    mr.run(os.path.join(TOOLS, '..', 'tests'), 'aep', 'https://worker.test', '', False, send=worker, out=lambda *_: None); refused = False
except SystemExit as e:
    refused = 'inside the AXIOM repository' in str(e)
t('a folder inside the repository is refused', refused)

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
