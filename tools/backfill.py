#!/usr/bin/env python3
"""Backfill AXIOM's permanent archive with historical series.

Loads years of history into the D1 archive (kind hist_*) so trend analysis
and predictions stand on a real foundation instead of a 72-hour window.
Run from your own machine (this needs open internet + your access key).

Sources:
  gdelt   GDELT DOC 2.0 monthly volume + tone per tracked issue (auto, 2017+;
          GDELT's public timeline API reaches back reliably to ~2017)
  wiki    Wikipedia monthly pageviews per politician/policy page (auto, 2015+)
  aec     A results CSV you download from results.aec.gov.au / AEC downloads
          (first preferences by party; --csv path, --election label)
  polls   A polls CSV you export (date,pollster,alp,lnp,grn[,oth...]) e.g.
          copied from Wikipedia's opinion-polling tables (--csv path)

Usage:
  python3 tools/backfill.py gdelt --key YOUR_ACCESS_KEY
  python3 tools/backfill.py wiki  --key YOUR_ACCESS_KEY
  python3 tools/backfill.py aec   --csv HouseFirstPrefsByParty.csv --election 2022 --key ...
  python3 tools/backfill.py polls --csv polls.csv --key ...
  python3 tools/backfill.py all   --key ...        # gdelt + wiki

Every row is deduplicated server-side by (kind, url), so re-runs are safe.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

DEFAULT_WORKER = "https://newsaus.heshan-998.workers.dev"

# The issues AXIOM tracks on the knowledge map - keep in sync with KM_ISSUES.
ISSUES = {
    "ftc": '"fuel tax credit" OR "diesel rebate"',
    "cm": '"critical minerals" australia',
    "col": '"cost of living" australia',
    "gov": 'australia newspoll OR "primary vote"',
    "auspol": 'australia politics',
}

# Wikipedia pages whose attention history matters. Add freely.
WIKI_PAGES = [
    "Anthony_Albanese", "Jim_Chalmers", "Peter_Dutton", "Adam_Bandt",
    "Australian_Labor_Party", "Liberal_Party_of_Australia",
    "Australian_Greens", "Reserve_Bank_of_Australia",
    "Negative_gearing", "Fuel_taxes_in_Australia",
]

UA = "axiom-backfill/1.0 (Curious Minds intelligence platform)"


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def post_rows(worker: str, key: str, kind: str, rows: list, dry: bool) -> int:
    """Send rows to /archive/add in batches of 120. Returns rows accepted."""
    total = 0
    for i in range(0, len(rows), 120):
        batch = rows[i:i + 120]
        if dry:
            total += len(batch)
            continue
        req = urllib.request.Request(
            worker.rstrip("/") + "/archive/add",
            data=json.dumps({"kind": kind, "rows": batch}).encode(),
            headers={"Content-Type": "application/json", "X-Axiom-Key": key, "User-Agent": UA},
            method="POST")
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.loads(r.read().decode())
        if not d.get("ok"):
            sys.exit(f"worker refused batch: {d}")
        total += d.get("added", 0)
        time.sleep(0.4)
    return total


def month_ts(ym: str) -> int:
    return int(datetime.strptime(ym + "-15", "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() * 1000)


def run_gdelt(args) -> None:
    rows = []
    for slug, query in ISSUES.items():
        for mode, label in (("timelinevol", "volume"), ("timelinetone", "tone")):
            url = ("https://api.gdeltproject.org/api/v2/doc/doc?query="
                   + urllib.parse.quote(f"{query} sourcecountry:AS")
                   + f"&mode={mode}&format=json&timelinesmooth=0"
                   + f"&STARTDATETIME={args.since}0101000000&ENDDATETIME="
                   + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"))
            try:
                d = get_json(url)
            except Exception as exc:
                print(f"  gdelt {slug}/{label} failed: {exc}"); continue
            series = ((d.get("timeline") or [{}])[0].get("data")) or []
            # daily points -> monthly means keep the archive lean
            months: dict[str, list[float]] = {}
            for pt in series:
                ym = str(pt.get("date", ""))[:6]
                if len(ym) == 6:
                    months.setdefault(f"{ym[:4]}-{ym[4:]}", []).append(float(pt.get("value", 0)))
            for ym, vals in sorted(months.items()):
                avg = sum(vals) / len(vals)
                rows.append({
                    "src": "gdelt", "title": f"{slug} {label} {ym}",
                    "url": f"hist:gdelt:{slug}:{label}:{ym}",
                    "meta": {"issue": slug, "series": label, "v": round(avg, 4)},
                    "ts": month_ts(ym),
                })
            print(f"  gdelt {slug}/{label}: {len(months)} months")
            time.sleep(1.0)
    print(f"gdelt: {post_rows(args.worker, args.key, 'hist_gdelt', rows, args.dry_run)} rows -> archive")


def run_wiki(args) -> None:
    rows = []
    end = datetime.now(timezone.utc).strftime("%Y%m%d00")
    for page in WIKI_PAGES:
        url = (f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
               f"en.wikipedia/all-access/user/{urllib.parse.quote(page)}/monthly/{args.since}010100/{end}")
        try:
            d = get_json(url)
        except Exception as exc:
            print(f"  wiki {page} failed: {exc}"); continue
        for it in d.get("items", []):
            ym = f"{it['timestamp'][:4]}-{it['timestamp'][4:6]}"
            rows.append({
                "src": "wikipedia", "title": f"{page.replace('_', ' ')} attention {ym}",
                "url": f"hist:wiki:{page}:{ym}",
                "meta": {"page": page, "views": it.get("views", 0)},
                "ts": month_ts(ym),
            })
        print(f"  wiki {page}: {len(d.get('items', []))} months")
        time.sleep(0.5)
    print(f"wiki: {post_rows(args.worker, args.key, 'hist_wiki', rows, args.dry_run)} rows -> archive")


def run_aec(args) -> None:
    if not args.csv:
        sys.exit("aec needs --csv (download 'First preferences by party' from results.aec.gov.au)")
    rows = []
    with open(args.csv, newline="", encoding="utf-8-sig") as f:
        # AEC CSVs carry an info line above the header
        sample = f.read(400); f.seek(0)
        if sample.count("\n") and "," not in sample.split("\n")[0]:
            f.readline()
        for r in csv.DictReader(f):
            party = (r.get("PartyNm") or r.get("PartyAb") or "").strip()
            votes = (r.get("TotalVotes") or r.get("Votes") or "0").replace(",", "")
            state = (r.get("StateAb") or "national").strip()
            if not party:
                continue
            rows.append({
                "src": "aec", "title": f"{args.election} first prefs - {party} ({state})",
                "url": f"hist:aec:{args.election}:{state}:{party}",
                "meta": {"election": args.election, "party": party, "state": state,
                         "votes": int(votes or 0), "pct": (r.get("Percentage") or "").strip()},
                "ts": month_ts(f"{args.election[:4]}-06") if args.election[:4].isdigit() else 0,
            })
    print(f"aec: parsed {len(rows)} rows from {args.csv}")
    print(f"aec: {post_rows(args.worker, args.key, 'hist_aec', rows, args.dry_run)} rows -> archive")


def run_polls(args) -> None:
    if not args.csv:
        sys.exit("polls needs --csv with columns: date,pollster,alp,lnp[,grn,oth,...]")
    rows = []
    with open(args.csv, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            date = (r.get("date") or "").strip()
            pollster = (r.get("pollster") or "poll").strip()
            if not date:
                continue
            nums = {k.strip().lower(): v.strip() for k, v in r.items()
                    if k and k.strip().lower() not in ("date", "pollster") and (v or "").strip()}
            try:
                ts = int(datetime.strptime(date[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() * 1000)
            except ValueError:
                continue
            rows.append({
                "src": "polls", "title": f"{pollster} {date}",
                "url": f"hist:poll:{pollster}:{date}",
                "meta": {"pollster": pollster, **nums}, "ts": ts,
            })
    print(f"polls: parsed {len(rows)} rows from {args.csv}")
    print(f"polls: {post_rows(args.worker, args.key, 'hist_polls', rows, args.dry_run)} rows -> archive")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("what", choices=["gdelt", "wiki", "aec", "polls", "all"])
    ap.add_argument("--worker", default=DEFAULT_WORKER)
    ap.add_argument("--key", default="", help="AXIOM access key (required once the worker secret is set)")
    ap.add_argument("--since", default="2017", help="start year for auto sources (gdelt>=2017, wiki>=2015)")
    ap.add_argument("--csv", default="", help="input file for aec/polls")
    ap.add_argument("--election", default="2022", help="election label for aec rows")
    ap.add_argument("--dry-run", action="store_true", help="fetch + parse but do not POST")
    args = ap.parse_args()
    steps = {"gdelt": [run_gdelt], "wiki": [run_wiki], "aec": [run_aec],
             "polls": [run_polls], "all": [run_gdelt, run_wiki]}[args.what]
    for step in steps:
        step(args)
    print("done. verify with /archive/search?kind=hist_gdelt&days=3650 (plus your key header).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
