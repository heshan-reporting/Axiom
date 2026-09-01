#!/usr/bin/env python3
"""
oppads.py - Google political-ads transparency -> AXIOM archive (opposition watch).

Google publishes every political ad it runs, per region, as a public CSV bundle
(~300 MB zipped, refreshed daily). This tool streams that bundle, keeps only the
Australian rows, and loads them into the permanent archive so the Sentinel,
the Analyst and the map can see who is paying to shape which debate.

Kinds written (all url-deduped, so re-runs are safe):
  oppads_gadv   one row per AU advertiser: lifetime AUD spend, creative count
  oppads_gweek  weekly AUD spend per AU advertiser
  oppads_gad    individual AU creatives served in the last --days days
                (state targeting sits in each creative's body/meta)

Usage:
  python3 tools/oppads.py extract [--zip bundle.zip] [--days 400] --out au.json
  python3 tools/oppads.py push --in au.json --key KEY [--worker URL] [--dry-run]
  python3 tools/oppads.py report --in au.json          # who is spending, on what
  python3 tools/oppads.py all --key KEY [--days 400]    # extract + push in one go

Stdlib only. Bundle: https://storage.googleapis.com/political-csv/google-political-ads-transparency-bundle.zip
"""
import argparse, csv, io, json, os, sys, time, urllib.request, zipfile
from datetime import datetime, timedelta

BUNDLE = 'https://storage.googleapis.com/political-csv/google-political-ads-transparency-bundle.zip'
WORKER = 'https://newsaus.heshan-998.workers.dev'
SRC = 'google_ads_transparency'
csv.field_size_limit(1 << 26)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def download(dest):
    log('downloading bundle (~300 MB) ...')
    req = urllib.request.Request(BUNDLE, headers={'User-Agent': 'axiom-oppads/1.0'})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, 'wb') as f:
        n = 0
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk); n += len(chunk)
            if n % (50 << 20) < (1 << 20):
                log('  %d MB' % (n >> 20))
    return dest


def rows_of(z, name):
    with z.open(name) as f:
        for row in csv.DictReader(io.TextIOWrapper(f, encoding='utf-8', newline='')):
            yield row


def ts_of(s):
    for fmt in ('%Y-%m-%dT%H:%M', '%Y-%m-%d'):
        try:
            return int(datetime.strptime(s[:16] if 'T' in s else s[:10], fmt).timestamp() * 1000)
        except Exception:
            pass
    return 0


def num(s):
    try:
        return int(float(s or 0))
    except Exception:
        return 0


def extract(zip_path, days):
    z = zipfile.ZipFile(zip_path)
    out = {'generated': datetime.utcnow().isoformat() + 'Z', 'advertisers': [], 'weekly': [], 'creatives': []}
    au_ids = {}
    log('advertisers ...')
    for r in rows_of(z, 'google-political-ads-advertiser-stats.csv'):
        if 'AU' not in (r.get('Regions') or ''):
            continue
        aid = r['Advertiser_ID']; name = r['Advertiser_Name'].strip()
        au_ids[aid] = name
        spend = num(r.get('Spend_AUD'))
        out['advertisers'].append({
            'src': SRC, 'title': name,
            'body': 'Google political advertiser (AU). Lifetime spend A$%s across %s creatives. Regions: %s.' % (
                format(spend, ','), r.get('Total_Creatives') or '0', r.get('Regions')),
            'url': 'https://adstransparency.google.com/advertiser/%s?region=AU&political' % aid,
            'author': aid, 'ts': int(time.time() * 1000),
            'meta': {'spend_aud': spend, 'creatives': num(r.get('Total_Creatives')), 'regions': r.get('Regions')},
        })
    log('  %d AU advertisers' % len(au_ids))

    log('weekly spend ...')
    for r in rows_of(z, 'google-political-ads-advertiser-weekly-spend.csv'):
        aid = r['Advertiser_ID']
        if aid not in au_ids:
            continue
        aud = num(r.get('Spend_AUD'))
        if aud <= 0:
            continue
        wk = r['Week_Start_Date']
        out['weekly'].append({
            'src': SRC, 'title': '%s - week of %s: A$%s' % (au_ids[aid], wk, format(aud, ',')),
            'body': '', 'url': 'x:oppads_gweek:%s:%s' % (aid, wk), 'author': aid,
            'ts': ts_of(wk), 'meta': {'spend_aud': aud, 'week': wk, 'advertiser': au_ids[aid]},
        })
    log('  %d weekly rows' % len(out['weekly']))

    # Google publishes state-level geo spend for the US only (verified 2026-09);
    # AU state targeting is recovered from each creative's Geo_Targeting instead.

    log('creatives (streaming the big file, a few minutes) ...')
    cutoff = datetime.utcnow() - timedelta(days=days)
    n = 0
    for r in rows_of(z, 'google-political-ads-creative-stats.csv'):
        n += 1
        if n % 2000000 == 0:
            log('  scanned %dM rows, %d AU creatives kept' % (n // 1000000, len(out['creatives'])))
        if 'AU' not in (r.get('Regions') or ''):
            continue
        end = r.get('Date_Range_End') or r.get('Date_Range_Start') or ''
        try:
            if datetime.strptime(end[:10], '%Y-%m-%d') < cutoff:
                continue
        except Exception:
            pass
        lo, hi = r.get('Spend_Range_Min_AUD') or '0', r.get('Spend_Range_Max_AUD') or ''
        out['creatives'].append({
            'src': SRC,
            'title': '%s: %s ad, %s to %s' % (r['Advertiser_Name'].strip(), (r.get('Ad_Type') or 'ad').lower(), r.get('Date_Range_Start'), end),
            'body': 'Impressions %s. Spend A$%s-%s. Age: %s. Gender: %s. Geo: %s.' % (
                r.get('Impressions') or '?', lo, hi or '?', r.get('Age_Targeting') or 'all', r.get('Gender_Targeting') or 'all',
                (r.get('Geo_Targeting_Included') or 'AU')[:300]),
            'url': r.get('Ad_URL') or ('x:oppads_gad:' + r.get('Ad_ID', '')), 'author': r.get('Advertiser_ID', ''),
            'ts': ts_of(r.get('Last_Served_Timestamp') or end),
            'meta': {'advertiser': r['Advertiser_Name'].strip(), 'type': r.get('Ad_Type'), 'impressions': r.get('Impressions'),
                     'spend_aud_min': num(lo), 'spend_aud_max': num(hi), 'start': r.get('Date_Range_Start'), 'end': end},
        })
    log('  %d AU creatives in the last %d days (scanned %d rows)' % (len(out['creatives']), days, n))
    return out


def post(worker, key, kind, rows, dry):
    added = 0
    for i in range(0, len(rows), 150):
        batch = rows[i:i + 150]
        if dry:
            added += len(batch); continue
        body = json.dumps({'kind': kind, 'rows': batch}).encode()
        req = urllib.request.Request(worker.rstrip('/') + '/archive/add', data=body, method='POST',
                                     headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': 'axiom-oppads/1.0'})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    d = json.loads(r.read().decode() or '{}')
                added += d.get('added', 0)
                break
            except Exception as e:
                if attempt == 3:
                    log('  batch failed for', kind, ':', e)
                else:
                    time.sleep(2 ** attempt)
    return added


def push(data, key, worker, dry):
    total = 0
    for kind, k in (('oppads_gadv', 'advertisers'), ('oppads_gweek', 'weekly'), ('oppads_gad', 'creatives')):
        n = post(worker, key, kind, data.get(k, []), dry)
        log('%s %s: %d rows' % ('would push' if dry else 'pushed', kind, n))
        total += n
    return total


def report(data):
    adv = sorted(data['advertisers'], key=lambda a: -a['meta']['spend_aud'])
    print('TOP AU POLITICAL ADVERTISERS ON GOOGLE (lifetime AUD)')
    for a in adv[:25]:
        print('  A$%10s  %s' % (format(a['meta']['spend_aud'], ','), a['title']))
    recent = {}
    cutoff = (datetime.utcnow() - timedelta(days=90)).strftime('%Y-%m-%d')
    for w in data['weekly']:
        if w['meta']['week'] >= cutoff:
            recent[w['meta']['advertiser']] = recent.get(w['meta']['advertiser'], 0) + w['meta']['spend_aud']
    print('\nLAST 90 DAYS - who is spending now')
    for name, aud in sorted(recent.items(), key=lambda x: -x[1])[:20]:
        print('  A$%10s  %s' % (format(aud, ','), name))
    watch = ['climate', 'australia institute', 'minerals', 'fortescue', 'conservation', 'lock the gate', 'greens', 'one nation',
             'labor', 'liberal', 'national', 'housing', 'property', 'builders', 'union', 'cfmeu', 'gas', 'energy', 'farmers', 'teal', 'climate 200', 'advance']
    print('\nISSUE-ADJACENT ADVERTISERS (name match)')
    for a in adv:
        t = a['title'].lower()
        if any(w in t for w in watch):
            print('  A$%10s  %s' % (format(a['meta']['spend_aud'], ','), a['title']))
    print('\n%d advertisers, %d weekly rows, %d recent creatives. Generated %s' % (
        len(data['advertisers']), len(data['weekly']), len(data['creatives']), data['generated']))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['extract', 'push', 'report', 'all'])
    ap.add_argument('--zip', help='already-downloaded bundle (otherwise downloads to a temp file)')
    ap.add_argument('--days', type=int, default=400, help='creatives newer than this many days (default 400)')
    ap.add_argument('--out', default='oppads-google-au.json')
    ap.add_argument('--in', dest='inp')
    ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--worker', default=WORKER)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    if a.cmd in ('extract', 'all'):
        zp = a.zip or download(os.path.join(os.environ.get('TMPDIR', '/tmp'), 'google-political-ads.zip'))
        data = extract(zp, a.days)
        with open(a.out, 'w') as f:
            json.dump(data, f)
        log('wrote', a.out)
        if a.cmd == 'extract':
            report(data); return
    else:
        with open(a.inp or a.out) as f:
            data = json.load(f)
    if a.cmd == 'report':
        report(data); return
    if not a.key and not a.dry_run:
        sys.exit('need --key (or AXIOM_KEY env) to push')
    n = push(data, a.key, a.worker, a.dry_run)
    log('done: %d rows %s' % (n, 'counted' if a.dry_run else 'archived'))


if __name__ == '__main__':
    main()
