#!/usr/bin/env python3
"""supermetrics2rows.py - turn saved Supermetrics data_query results into AXIOM archive rows (kind 'campaign').
Usage: python3 sm2rows.py out.json <platform>=<result-file.json> ...
Each result file is the tool-results JSON {success, data:{data:[[header],[row]...], requested_field_ids:[...]}}.
Rows: one per campaign-day with spend>0 or impressions>0; url 'x:campaign:<platform>:<campaign_id>:<date>'.
"""
import json, re, sys, time
from datetime import datetime

NS_RULES = [
    (re.compile(r'hands ?off|hoof|minerals', re.I), 'mca'),
    (re.compile(r'energy producers', re.I), 'aep'),
    (re.compile(r'nationals|mckenzie|nfrv', re.I), 'vicnats'),
    (re.compile(r'property council', re.I), 'pca'),
    (re.compile(r'master ?builders|level the site|\bmba\b', re.I), 'mba'),
]
def ns_for(account, campaign=''):
    hay = (account or '') + ' ' + (campaign or '')
    for rx, ns in NS_RULES:
        if rx.search(hay):
            return ns
    return 'cmm'

# platform -> (field ids for: date, account, account_id, campaign, campaign_id, spend, impressions, clicks, ctr, cpc, cpm, leads, reach, objective)
MAPS = {
    'meta':      dict(date='Date', acct='profile', acct_id='profileID', camp='adcampaign_name', camp_id='adcampaign_id', spend='cost', imp='impressions', clicks='action_link_click', ctr='link_CTR', cpc='CPLC', cpm='CPM', leads=['onsite_conversion.lead_grouped', 'offsite_conversions_fb_pixel_lead'], reach='reach', obj='campaignobjective'),
    'google':    dict(date='Date', acct='profile', acct_id='profileID', camp='Campaignname', camp_id='CampaignID', spend='Cost', imp='Impressions', clicks='Clicks', ctr='Ctr', cpc='CPC', cpm='CPM', leads=['Conversions']),
    'linkedin':  dict(date='date', acct='accountName', acct_id='accountId', camp='campaignName', camp_id='campaignId', spend='spend', imp='impressions', clicks='clicks', ctr='ctr', cpc='cpc', cpm='cpm', leads=['oneClickLeads', 'conversions'], obj='campaignObjectiveType'),
    'tiktok':    dict(date='date', acct='advertiser_name', acct_id='advertiser_id', camp='campaign_name', camp_id='campaign_id', spend='cost', imp='impressions', clicks='clicks', ctr='ctr', cpc='cpc', cpm='cpm', leads=['conversions'], reach='reach'),
    'reddit':    dict(date='date', acct='account_name', acct_id='account_id', camp='campaign_name', camp_id='campaign_id', spend='spend', imp='impressions', clicks='clicks', ctr='ctr', cpc='cpc', leads=['conversion_lead_clicks', 'conversion_sign_up_clicks'], obj='objective'),
    'pinterest': dict(date='date', acct='advertiser_name', acct_id='advertiser_id', camp='campaign_name', camp_id='campaign_id', spend='cost', imp='total_impressions', clicks='total_clickthrough', ctr='ctr_rate', cpc='cpc', cpm='cpm', leads=['total_lead', 'total_signup'], obj='campaign_objective_type'),
    'snapchat':  dict(date='date', acct='ad_account_name', acct_id='ad_account_id', camp='campaign_name', camp_id='campaign_id', spend='cost', imp='impressions', clicks='swipes', cpm='paid_ecpm', leads=['landing_page_views'], obj='campaign_objective'),
}

def num(v):
    try:
        return float(v) if v not in (None, '', 'null') else 0.0
    except Exception:
        return 0.0

def load(path):
    import csv, io
    d = json.load(open(path))
    data = d['data'] if 'data' in d and isinstance(d['data'], dict) else d
    rows = data.get('data') or []
    ids = data.get('requested_field_ids') or []
    if isinstance(rows, str):
        # compressed text: lines like "  - [14,]: v1,v2,\"quoted\",..."
        parsed = []
        for line in rows.split('\n'):
            line = line.strip()
            if not line.startswith('- ['):
                continue
            payload = line.split(']: ', 1)[1] if ']: ' in line else ''
            # compressed rows escape embedded quotes with a backslash (e.g. Post: \"Right now\")
            parsed.append(next(csv.reader(io.StringIO(payload), escapechar='\\', doublequote=False)))
        rows = parsed
    if not rows:
        return ids, []
    return ids, rows[1:]  # drop display-name header row

def convert(platform, path):
    m = MAPS[platform]
    ids, rows = load(path)
    idx = {f: i for i, f in enumerate(ids)}
    def g(r, key):
        f = m.get(key)
        if f is None: return None
        if isinstance(f, list):
            return sum(num(r[idx[x]]) for x in f if x in idx)
        return r[idx[f]] if f in idx else None
    out = []
    for r in rows:
        spend, imp = num(g(r, 'spend')), num(g(r, 'imp'))
        if spend <= 0 and imp <= 0:
            continue
        if spend > 500000 or len(r) != len(ids):
            print('  ! skipping malformed row:', str(r)[:160], file=sys.stderr)
            continue
        date = str(g(r, 'date'))[:10]
        acct, camp = g(r, 'acct') or '', g(r, 'camp') or ''
        clicks, leads = num(g(r, 'clicks')), num(g(r, 'leads'))
        ctr, cpc, cpm, reach = num(g(r, 'ctr')), num(g(r, 'cpc')), num(g(r, 'cpm')), num(g(r, 'reach'))
        # Google/LinkedIn/Reddit/Pinterest report CTR as a fraction (0.0365); Meta reports percent (3.65).
        if platform in ('google', 'linkedin', 'reddit', 'pinterest'):
            ctr *= 100
        ns = ns_for(acct, camp)
        body = ('%s | %s: spend $%.2f, %d impressions, %d clicks (CTR %.2f%%, CPC $%.2f, CPM $%.2f)'
                % (platform, acct, spend, imp, clicks, ctr, cpc, cpm))
        if reach: body += ', reach %d' % reach
        if leads: body += ', %d leads/conversions (CPL $%.2f)' % (leads, spend / leads if leads else 0)
        obj = g(r, 'obj')
        if obj: body += '. Objective %s' % obj
        out.append({
            'src': platform, 'title': '%s - %s' % (camp or 'campaign', date), 'body': body,
            'url': 'x:campaign:%s:%s:%s' % (platform, g(r, 'camp_id') or camp, date), 'author': str(g(r, 'acct_id') or ''),
            'ts': int(datetime.strptime(date, '%Y-%m-%d').timestamp() * 1000),
            'meta': {'ns': ns, 'platform': platform, 'account': acct, 'campaign': camp, 'day': date, 'spend': round(spend, 2),
                     'impressions': int(imp), 'clicks': int(clicks), 'ctr': round(ctr, 4), 'cpc': round(cpc, 4), 'cpm': round(cpm, 4),
                     'leads': int(leads), 'reach': int(reach), 'objective': obj or ''},
        })
    return out

if __name__ == '__main__':
    outp = sys.argv[1]
    allrows = []; summary = {}
    for spec in sys.argv[2:]:
        plat, path = spec.split('=', 1)
        rows = convert(plat, path)
        allrows += rows
        spend = sum(r['meta']['spend'] for r in rows)
        summary[plat] = (len(rows), round(spend, 2), sorted({r['meta']['ns'] for r in rows}))
    json.dump({'kind': 'campaign', 'generated': datetime.utcnow().isoformat() + 'Z', 'rows': allrows}, open(outp, 'w'))
    for k, v in summary.items():
        print('%-10s %6d campaign-days  $%12s  ns=%s' % (k, v[0], format(v[1], ','), ','.join(v[2])))
    print('total', len(allrows), 'rows ->', outp)
