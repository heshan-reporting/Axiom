#!/usr/bin/env python3
"""
den-pull-plan.py - what to ask the Supermetrics public-data connectors for
today, for one client's desk.

It reads the desk's plan from the worker (GET /den/plan?ns=..., read role) or
from a saved copy, and prints one query a line as JSON: the arguments for the
Supermetrics connector's data_query in a Claude Code session, and the file to
save the answer as. Then:

  python3 tools/supermetrics2signals.py out.json --ns aep --key $AXIOM_KEY \\
      fbposts=fbposts.json igposts=igposts.json ighash=ighash.json urlshares=urlshares.json --push

It asks for nothing itself and spends nothing. Instagram allows thirty unique
hashtags in any seven days: the plan says how many are left, and no more than
that are printed.

Usage:
  python3 tools/den-pull-plan.py --ns aep --key $AXIOM_KEY [--worker URL] [--days 3]
  python3 tools/den-pull-plan.py --ns aep --plan plan.json
"""
import argparse, json, os, sys, urllib.request

WORKER = 'https://newsaus.heshan-998.workers.dev'
FB_FIELDS = 'link,post_id,created_time,permalink_url,message,reactions_count,reactions_love,reactions_wow,reactions_haha,reactions_sad,reactions_angry,likes_count,comments_count,shares_count'
IG_FIELDS = 'username,post_id,post_timestamp,post_type,post_permalink,post_caption,post_likes,post_comments,post_views'
IGH_FIELDS = 'hashtag_name,post_id,post_timestamp,post_type,post_permalink,post_caption,post_likes,post_comments'
URL_FIELDS = 'url,reaction_count,comment_count,share_count'


def queries(plan, days=3):
    p = plan.get('plan') or {}; out = []; rng = 'last_%d_days' % max(1, min(int(days), 30))
    fb = [a['value'] for a in (p.get('facebook') or {}).get('accounts') or []]
    if fb:
        out.append({'ds_id': 'FBPD', 'ds_accounts': ','.join(fb), 'fields': FB_FIELDS, 'date_range_type': rng, 'settings': {'report_type': 'PagePosts'}, 'save_as': 'fbposts.json'})
    ig = p.get('instagram') or {}
    accts = [a['value'] for a in ig.get('accounts') or []]
    if accts:
        out.append({'ds_id': 'IGPD2', 'ds_accounts': ','.join(accts), 'fields': IG_FIELDS, 'date_range_type': rng, 'settings': {'report_type': 'BusinessDiscoveryMedia'}, 'save_as': 'igposts.json'})
    left = int((ig.get('hashtagAllowance') or {}).get('left', 30))
    tags = [t['value'] for t in ig.get('hashtags') or []][:max(0, left)]
    if tags:
        out.append({'ds_id': 'IGPD2', 'ds_accounts': ','.join(tags), 'fields': IGH_FIELDS, 'settings': {'report_type': 'HashtagSearchMedia', 'result_type': 'recent_media'}, 'save_as': 'ighash.json'})
    urls = plan.get('urls') or []
    if urls:
        out.append({'ds_id': 'FBPD', 'ds_accounts': ','.join(urls), 'fields': URL_FIELDS, 'settings': {'report_type': 'UrlShares'}, 'save_as': 'urlshares.json'})
    return out, {'hashtags_left': left, 'hashtags_held_back': max(0, len(ig.get('hashtags') or []) - len(tags))}


def main(argv=None):
    ap = argparse.ArgumentParser(description='the day\'s Supermetrics queries for one desk')
    ap.add_argument('--ns', required=True); ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', '')); ap.add_argument('--worker', default=WORKER)
    ap.add_argument('--plan', help='a saved GET /den/plan answer'); ap.add_argument('--days', type=int, default=3)
    a = ap.parse_args(argv)
    if a.plan:
        plan = json.load(open(a.plan))
    elif a.key:
        req = urllib.request.Request(a.worker.rstrip('/') + '/den/plan?ns=' + a.ns, headers={'X-Axiom-Key': a.key, 'User-Agent': 'axiom-den/1.0'})
        with urllib.request.urlopen(req, timeout=30) as r:
            plan = json.loads(r.read().decode() or '{}')
    else:
        sys.exit('give --key (or AXIOM_KEY) to read the plan from the worker, or --plan FILE')
    if not plan.get('ok', True):
        sys.exit('the worker refused: %s - %s' % (plan.get('error'), plan.get('detail')))
    qs, note = queries(plan, a.days)
    if not qs:
        print('# nothing to ask for: the register for %s has no active Facebook page, Instagram account or hashtag, and no news address is waiting' % a.ns, file=sys.stderr)
        return 0
    print('# %d queries for %s. Instagram hashtags left this week: %d%s' % (len(qs), a.ns, note['hashtags_left'], ('; %d held back' % note['hashtags_held_back']) if note['hashtags_held_back'] else ''), file=sys.stderr)
    for q in qs:
        print(json.dumps(q))
    return 0


if __name__ == '__main__':
    sys.exit(main())
