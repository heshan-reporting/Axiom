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

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
