#!/usr/bin/env python3
"""
supermetrics2social.py - engagement, ad creatives, organic posts and comments
from saved Supermetrics results -> AXIOM archive rows.

Datasets (name=file, any mix):
  fa_engagement  Meta Ads campaign-day engagement -> kind 'engagement'
                 fields: Date,profile,profileID,adcampaign_name,adcampaign_id,impressions,cost,
                         action_post_engagement,action_post_like,action_comment,action_post,post_save,
                         action_video_view,video_thruplay_watched_actions
  fa_creative    Meta Ads ad-level lifetime -> kind 'adcreative' (the ad copy + its reactions)
                 fields: profile,profileID,adcampaign_name,adcampaign_id,ad_name,ad_id,creative_title,
                         creative_body,promoted_post_id,impressions,cost,action_link_click,action_post_like,
                         action_comment,action_post,post_save,video_thruplay_watched_actions
  fb_post        Facebook Insights post-level -> kind 'social_post'
                 fields: post_ID,post_name,post_message,post_linkto,post_type,profile? (page name via account),
                         post_media_views,post_reactions_total,post_comments_on_post,post_shares_on_post,post_link_clicks
  fb_comment     Facebook Insights comments -> kind 'comments'
                 fields: post_ID,post_message,post_comment_date,post_comment_text  (author not stored)
  ig_post        Instagram Insights media -> kind 'social_post'
                 fields: media_id,timestamp,media_type,media_permalink,media_caption,media_reach,media_like_count,
                         media_comments_count,media_shares,media_saved,media_views
  ig_comment     Instagram MediaComments -> kind 'comments'
                 fields: media_id,media_permalink,media_caption,media_comment_date,media_comment_text
  li_post        LinkedIn Pages update_details -> kind 'social_post'
                 fields: profile,update_id,update_title,update_share_comment,update_url,page_impressions,
                         page_likes,page_comments,page_shares,page_clicks,page_engagements
  li_comment     LinkedIn Pages ShareCommentsDetail -> kind 'comments'
                 fields: profile,share_id,share_title,share_comment,share_comment_date

Output: {"batches":[{kind, rows}...]} for tools/archive-push.py. Comments carry
`tone` (-1/0/1) from a colloquial lexicon so retrieval can weigh hostility.
Usage: python3 tools/supermetrics2social.py out.json fa_engagement=FILE fa_creative=FILE ...
"""
import csv, io, json, re, sys
from datetime import datetime

sys.path.insert(0, __import__('os').path.dirname(__file__))
try:
    from supermetrics2rows import ns_for, load, num  # shared helpers
except Exception:  # pragma: no cover - fallback if run from elsewhere
    def ns_for(a, c=''): return 'cmm'
    def num(v):
        try: return float(v) if v not in (None, '', 'null') else 0.0
        except Exception: return 0.0
    def load(path):
        d = json.load(open(path)); data = d['data'] if isinstance(d.get('data'), dict) else d
        rows = data.get('data') or []; ids = data.get('requested_field_ids') or []
        if isinstance(rows, str):
            parsed = []
            for line in rows.split('\n'):
                line = line.strip()
                if line.startswith('- [') and ']: ' in line:
                    parsed.append(next(csv.reader(io.StringIO(line.split(']: ', 1)[1]), escapechar='\\', doublequote=False)))
            rows = parsed
        return ids, (rows[1:] if rows else [])

CMT_POS = re.compile(r"\b(agree|well said|spot on|100 ?%|thank you|thanks|love (this|it)|great|good on (you|them|ya)|exactly|so true|support(ed|ing)?|keep (it )?up|finally|about time|legend|onya|well done|fair enough|makes sense)\b|\+1|<3", re.I)
CMT_NEG = re.compile(r"\b(lies?|lying|liar|rubbish|garbage|bs|bullshit|scam|greedy?|greed|disgrace(ful)?|disgusting|joke|pathetic|propaganda|shame(ful)?|corrupt(ion)?|hypocri\w*|nonsense|rort|polluters?|wrong|nobody believes|sick of|fed up|rip ?off|dodgy|spin|misleading|shill|paid for|who funds)\b", re.I)
def tone(t):
    s = str(t or '')
    return -1 if CMT_NEG.search(s) else (1 if CMT_POS.search(s) else 0)

def ts(s):
    s = str(s or '')[:19]
    for f in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try: return int(datetime.strptime(s[:len(f) + (0 if 'T' in f or ' ' in f else 0)], f).timestamp() * 1000)
        except Exception: pass
    try: return int(datetime.strptime(s[:10], '%Y-%m-%d').timestamp() * 1000)
    except Exception: return int(datetime.utcnow().timestamp() * 1000)

def rows_of(path):
    ids, rows = load(path)
    idx = {f: i for i, f in enumerate(ids)}
    def g(r, f, default=''):
        return r[idx[f]] if f in idx and idx[f] < len(r) else default
    return [(r, g) for r in rows if len(r) == len(ids)]

def fa_engagement(path):
    out = []
    for r, g in rows_of(path):
        imp, cost = num(g(r, 'impressions')), num(g(r, 'cost'))
        eng = num(g(r, 'action_post_engagement')); rx = num(g(r, 'action_post_like')); cm = num(g(r, 'action_comment'))
        sh = num(g(r, 'action_post')); sv = num(g(r, 'post_save')); vv = num(g(r, 'action_video_view')); tp = num(g(r, 'video_thruplay_watched_actions'))
        if not (imp or eng or rx or cm or sh):
            continue
        d = str(g(r, 'Date'))[:10]; acct = g(r, 'profile'); camp = g(r, 'adcampaign_name')
        out.append({'src': 'meta', 'title': '%s - engagement %s' % (camp, d),
            'body': 'meta | %s: %d reactions, %d comments, %d shares, %d saves, %d post engagements on %d impressions ($%.2f); %d 3s video views, %d ThruPlays.' % (acct, rx, cm, sh, sv, eng, imp, cost, vv, tp),
            'url': 'x:engagement:meta:%s:%s' % (g(r, 'adcampaign_id') or camp, d), 'author': str(g(r, 'profileID')), 'ts': ts(d),
            'meta': {'ns': ns_for(acct, camp), 'platform': 'meta', 'account': acct, 'campaign': camp, 'day': d, 'impressions': int(imp), 'spend': round(cost, 2),
                     'reactions': int(rx), 'comments': int(cm), 'shares': int(sh), 'saves': int(sv), 'engagements': int(eng), 'video_views_3s': int(vv), 'thruplays': int(tp)}})
    return out

def fa_creative(path):
    out = []
    for r, g in rows_of(path):
        imp = num(g(r, 'impressions'))
        if imp <= 0: continue
        acct, camp, ad = g(r, 'profile'), g(r, 'adcampaign_name'), g(r, 'ad_name')
        body_txt = str(g(r, 'creative_body') or '').strip(); title_txt = str(g(r, 'creative_title') or '').strip()
        rx, cm, sh, sv = num(g(r, 'action_post_like')), num(g(r, 'action_comment')), num(g(r, 'action_post')), num(g(r, 'post_save'))
        clicks, cost, tp = num(g(r, 'action_link_click')), num(g(r, 'cost')), num(g(r, 'video_thruplay_watched_actions'))
        out.append({'src': 'meta', 'title': '%s | %s' % (camp, ad)[:300],
            'body': ('AD COPY: ' + (title_txt + ' - ' if title_txt else '') + body_txt[:1200] + '\n' if (body_txt or title_txt) else '') +
                    'Lifetime: %d impressions, %d link clicks, %d reactions, %d comments, %d shares, %d saves, %d ThruPlays, $%.2f spend.' % (imp, clicks, rx, cm, sh, sv, tp, cost),
            'url': 'x:adcreative:meta:%s' % (g(r, 'ad_id') or ad), 'author': str(g(r, 'profileID')), 'ts': int(datetime.utcnow().timestamp() * 1000),
            'meta': {'ns': ns_for(acct, camp), 'platform': 'meta', 'account': acct, 'campaign': camp, 'ad': ad, 'post_id': g(r, 'promoted_post_id'),
                     'impressions': int(imp), 'clicks': int(clicks), 'reactions': int(rx), 'comments': int(cm), 'shares': int(sh), 'saves': int(sv), 'thruplays': int(tp), 'spend': round(cost, 2),
                     'engagement_rate': round((rx + cm + sh) / imp * 100, 3) if imp else 0}})
    return out

def fb_post(path):
    out = []
    for r, g in rows_of(path):
        pid = g(r, 'post_ID');
        if not pid: continue
        msg = str(g(r, 'post_message') or g(r, 'post_name') or '')
        rx, cm, sh, vw, cl = num(g(r, 'post_reactions_total')), num(g(r, 'post_comments_on_post')), num(g(r, 'post_shares_on_post')), num(g(r, 'post_media_views')), num(g(r, 'post_link_clicks'))
        out.append({'src': 'facebook', 'title': msg[:140] or ('Post ' + pid), 'body': msg[:2000] + '\n%d reactions, %d comments, %d shares, %d views, %d link clicks.' % (rx, cm, sh, vw, cl),
            'url': g(r, 'post_linkto') or ('https://www.facebook.com/' + pid), 'ts': ts(g(r, 'Date') or g(r, 'date')),
            'meta': {'ns': ns_for(g(r, 'profile'), msg), 'platform': 'facebook', 'post_id': pid, 'type': g(r, 'post_type'), 'reactions': int(rx), 'comments': int(cm), 'shares': int(sh), 'views': int(vw), 'clicks': int(cl)}})
    return out

def fb_comment(path):
    out = []
    for r, g in rows_of(path):
        txt = str(g(r, 'post_comment_text') or '').strip()
        if not txt: continue
        pid = g(r, 'post_ID'); when = (g(r, 'post_comment_date') or '') + ' ' + (g(r, 'post_comment_time') or '')
        out.append({'src': 'facebook', 'title': 'Comment on: ' + str(g(r, 'post_message') or pid)[:100], 'body': txt[:2000], 'author': '', 'tone': tone(txt),
            'url': 'x:comment:facebook:%s:%s' % (pid, abs(hash(txt + when)) % 10**10), 'ts': ts(when.strip()),
            'meta': {'ns': ns_for(g(r, 'profile'), g(r, 'post_message')), 'platform': 'facebook', 'post_id': pid, 'tone': tone(txt)}})
    return out

def ig_post(path):
    out = []
    for r, g in rows_of(path):
        mid = g(r, 'media_id')
        if not mid: continue
        cap = str(g(r, 'media_caption') or '')
        lk, cm, sh, sv, rc, vw = num(g(r, 'media_like_count')), num(g(r, 'media_comments_count')), num(g(r, 'media_shares')), num(g(r, 'media_saved')), num(g(r, 'media_reach')), num(g(r, 'media_views'))
        out.append({'src': 'instagram', 'title': cap[:140] or ('Instagram ' + str(g(r, 'media_type'))), 'body': cap[:2000] + '\n%d likes, %d comments, %d shares, %d saves, reach %d, %d views.' % (lk, cm, sh, sv, rc, vw),
            'url': g(r, 'media_permalink') or ('x:igpost:' + mid), 'ts': ts(g(r, 'timestamp')),
            'meta': {'ns': ns_for(g(r, 'username'), cap), 'platform': 'instagram', 'media_id': mid, 'type': g(r, 'media_type'), 'likes': int(lk), 'comments': int(cm), 'shares': int(sh), 'saves': int(sv), 'reach': int(rc), 'views': int(vw)}})
    return out

def ig_comment(path):
    out = []
    for r, g in rows_of(path):
        txt = str(g(r, 'media_comment_text') or '').strip()
        if not txt: continue
        mid = g(r, 'media_id'); when = (g(r, 'media_comment_date') or '') + ' ' + (g(r, 'media_comment_time') or '')
        out.append({'src': 'instagram', 'title': 'Comment on: ' + str(g(r, 'media_caption') or mid)[:100], 'body': txt[:2000], 'author': '', 'tone': tone(txt),
            'url': 'x:comment:instagram:%s:%s' % (mid, abs(hash(txt + when)) % 10**10), 'ts': ts(when.strip()),
            'meta': {'ns': ns_for(g(r, 'username'), g(r, 'media_caption')), 'platform': 'instagram', 'media_id': mid, 'permalink': g(r, 'media_permalink'), 'tone': tone(txt)}})
    return out

def li_post(path):
    out = []
    for r, g in rows_of(path):
        uid = g(r, 'update_id')
        if not uid: continue
        txt = str(g(r, 'update_share_comment') or g(r, 'update_title') or '')
        imp, lk, cm, sh, cl, en = (num(g(r, k)) for k in ('page_impressions', 'page_likes', 'page_comments', 'page_shares', 'page_clicks', 'page_engagements'))
        out.append({'src': 'linkedin', 'title': txt[:140] or ('LinkedIn update ' + uid), 'body': txt[:2000] + '\n%d impressions, %d likes, %d comments, %d shares, %d clicks, %d engagements.' % (imp, lk, cm, sh, cl, en),
            'url': g(r, 'update_url') or ('x:lipost:' + uid), 'ts': ts(g(r, 'date')),
            'meta': {'ns': ns_for(g(r, 'profile'), txt), 'platform': 'linkedin', 'update_id': uid, 'impressions': int(imp), 'likes': int(lk), 'comments': int(cm), 'shares': int(sh), 'clicks': int(cl), 'engagements': int(en)}})
    return out

def li_comment(path):
    out = []
    for r, g in rows_of(path):
        txt = str(g(r, 'share_comment') or '').strip()
        if not txt: continue
        sid = g(r, 'share_id'); when = g(r, 'share_comment_date') or ''
        out.append({'src': 'linkedin', 'title': 'Comment on: ' + str(g(r, 'share_title') or sid)[:100], 'body': txt[:2000], 'author': '', 'tone': tone(txt),
            'url': 'x:comment:linkedin:%s:%s' % (sid, abs(hash(txt + when)) % 10**10), 'ts': ts(when),
            'meta': {'ns': ns_for(g(r, 'profile'), g(r, 'share_title')), 'platform': 'linkedin', 'share_id': sid, 'tone': tone(txt)}})
    return out

KIND = {'fa_engagement': ('engagement', fa_engagement), 'fa_creative': ('adcreative', fa_creative),
        'fb_post': ('social_post', fb_post), 'fb_comment': ('comments', fb_comment),
        'ig_post': ('social_post', ig_post), 'ig_comment': ('comments', ig_comment),
        'li_post': ('social_post', li_post), 'li_comment': ('comments', li_comment)}

if __name__ == '__main__':
    outp = sys.argv[1]; batches = {}
    for spec in sys.argv[2:]:
        name, path = spec.split('=', 1)
        kind, fn = KIND[name]
        rows = fn(path)
        batches.setdefault(kind, []).extend(rows)
        extra = ''
        if kind == 'comments' and rows:
            t = [r['tone'] for r in rows]; extra = '  tone: %d hostile / %d neutral / %d supportive' % (t.count(-1), t.count(0), t.count(1))
        print('%-14s -> %-12s %6d rows%s' % (name, kind, len(rows), extra))
    json.dump({'generated': datetime.utcnow().isoformat() + 'Z', 'batches': [{'kind': k, 'rows': v} for k, v in batches.items()]}, open(outp, 'w'))
    print('wrote', outp, 'with', sum(len(v) for v in batches.values()), 'rows')
