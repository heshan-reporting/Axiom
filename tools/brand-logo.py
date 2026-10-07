#!/usr/bin/env python3
"""Put a client's logo into its brand kit exactly as supplied.

The Studio places the kit logo as an exact image layer on every composition; it is never redrawn or
regenerated. This tool uploads the file you have (PNG, JPEG or WebP, up to 2 MB) to the live worker,
which stores it in R2 under brand/<ns>/logo and serves it only for that client's work.

  python3 tools/brand-logo.py path/to/logo.png --ns mca --key $AXIOM_KEY
  python3 tools/brand-logo.py --ns mca --key $AXIOM_KEY --check      # what the kit holds now

A campaign can carry its own mark. Hands Off Our Fuel tiles show the HANDS OFF OUR FUEL wordmark and never the MCA logo:

  python3 tools/brand-logo.py path/to/hoof-wordmark.png --ns mca --campaign hoof --wordmark --key $AXIOM_KEY
  python3 tools/brand-logo.py --ns mca --campaign hoof --policy wordmark --key $AXIOM_KEY   # logo | wordmark | both | none
  python3 tools/brand-logo.py --ns mca --campaign hoof --wordmark --remove --key $AXIOM_KEY                 # retire the older single wordmark
  python3 tools/brand-logo.py --ns mca --campaign hoof --wordmark --variant black --remove --key $AXIOM_KEY # retire one variant

The client logo can carry approved colour variants too (a white one for dark grounds); the primary logo stays as it is,
and the Studio places whichever approved file reads on the ground under it (S21):
  python3 tools/brand-logo.py mca-logo-white.png --ns mca --variant white --tone light --key $AXIOM_KEY
  python3 tools/brand-logo.py --ns mca --variant white --remove --key $AXIOM_KEY      # retire a logo variant

A campaign can hold several approved colour variants of its wordmark (each stored under its own immutable, versioned
key; uploading one never replaces another). The Studio offers them all on the mark layer, picks the one that suits a
known ground, and the browser's measurement switches to the variant with the best real contrast when it fixes a layout:

  python3 tools/brand-logo.py hoof-wordmark-blue.png  --ns mca --campaign hoof --wordmark --variant blue  --tone colour --default --key $AXIOM_KEY
  python3 tools/brand-logo.py hoof-wordmark-white.png --ns mca --campaign hoof --wordmark --variant white --tone light --key $AXIOM_KEY
  python3 tools/brand-logo.py hoof-wordmark-black.png --ns mca --campaign hoof --wordmark --variant black --tone dark  --key $AXIOM_KEY

--tone says what the variant is (light for a white mark, dark for a black one, colour otherwise); --default makes it
the variant used when the ground is unknown.

The policy decides which mark the Studio places on that campaign's compositions (uploading a wordmark sets it to
"wordmark" unless the campaign already had a policy). Nothing else in the kit is touched: campaigns, facts, banned
terms, palette and fonts stay as they are.
"""
import argparse, base64, json, mimetypes, os, sys, urllib.request, urllib.error

DEFAULT_WORKER = 'https://newsaus.heshan-998.workers.dev'


def http(base, key, method, path, body=None):
    # Cloudflare refuses Python's default User-Agent with an empty 403, so name the tool.
    req = urllib.request.Request(base + path, method=method, headers={'Content-Type': 'application/json', 'X-Axiom-Key': key, 'User-Agent': 'axiom-brand-logo/1.0'},
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors='replace')
        try:
            d = json.loads(raw or '{}')
        except Exception:
            d = {}
        why = (d.get('error', '') + ' ' + d.get('detail', '')).strip() or ('(no JSON body: %s)' % (raw[:160].replace('\n', ' ') or 'empty - a 403 with no body is Cloudflare refusing the request before the worker saw it'))
        raise SystemExit('%s %s -> HTTP %s %s' % (method, path, e.code, why))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('file', nargs='?'); ap.add_argument('--ns', required=True); ap.add_argument('--key', required=True)
    ap.add_argument('--worker', default=DEFAULT_WORKER); ap.add_argument('--check', action='store_true')
    ap.add_argument('--campaign', help='campaign id the wordmark or policy belongs to'); ap.add_argument('--wordmark', action='store_true', help='upload the file as that campaign\'s wordmark')
    ap.add_argument('--policy', choices=['logo', 'wordmark', 'both', 'none'], help='which mark that campaign\'s compositions carry')
    ap.add_argument('--variant', help='the name of this approved colour variant (blue, white, black...): of the campaign wordmark with --wordmark, else of the client logo')
    ap.add_argument('--tone', choices=['light', 'dark', 'colour'], help='with --variant: light for a white mark, dark for a black one, colour otherwise')
    ap.add_argument('--default', action='store_true', help='with --variant: the variant used when the ground is unknown')
    ap.add_argument('--remove', action='store_true', help='with --wordmark: take the single wordmark (or, with --variant, that variant) off new compositions; versioned copies stay for approved work')
    a = ap.parse_args()
    base = a.worker.rstrip('/')
    if a.policy and not a.campaign:
        raise SystemExit('--policy needs --campaign')
    if a.wordmark and not a.campaign:
        raise SystemExit('--wordmark needs --campaign')
    if a.remove and a.variant and not a.wordmark and not a.file:
        k = http(base, a.key, 'POST', '/brand/kit', {'ns': a.ns, 'removeLogoVariant': a.variant})
        print('%s: logo variant %s retired from new compositions (its versioned copy stays, so approved work keeps its exact file)' % (a.ns, a.variant))
        print('logo variants on file: ' + (', '.join(x.get('variant') for x in (k.get('kit') or {}).get('logoVariants') or []) or 'none'))
        return
    if a.remove:
        if not (a.wordmark and a.campaign) or a.file:
            raise SystemExit('--remove goes with --wordmark --campaign (and --variant to retire one variant), without a file')
        body = {'ns': a.ns, 'removeWordmark': True, 'wordmarkCampaign': a.campaign}
        if a.variant:
            body['wordmarkVariant'] = a.variant
        k = http(base, a.key, 'POST', '/brand/kit', body)
        camp = next((c for c in (k.get('kit') or {}).get('campaigns') or [] if c.get('id') == a.campaign), {})
        print('%s / %s: %s retired from new compositions (its versioned copy stays, so approved work keeps its exact mark)' % (a.ns, a.campaign, ('variant ' + a.variant) if a.variant else 'the single wordmark'))
        print('mark policy %s; single wordmark %s; variants on file: %s' % (camp.get('logoPolicy'), 'on file' if camp.get('wordmarkV') else 'none', ', '.join(w.get('variant') for w in camp.get('wordmarks') or []) or 'none'))
        return
    if a.policy and not a.file:
        k = http(base, a.key, 'POST', '/brand/kit', {'ns': a.ns, 'removeWordmark': False, 'wordmarkCampaign': a.campaign, 'logoPolicy': a.policy, 'wordmarkB64': ''})
        camp = next((c for c in (k.get('kit') or {}).get('campaigns') or [] if c.get('id') == a.campaign), None)
        if not camp:
            raise SystemExit('unknown campaign %s; the kit has: %s' % (a.campaign, ', '.join(c['id'] for c in (k.get('kit') or {}).get('campaigns') or [])))
        print('%s / %s: mark policy now %s (wordmark %s)' % (a.ns, a.campaign, camp.get('logoPolicy'), 'on file' if camp.get('hasWordmark') else 'not on file'))
        return
    if a.check or not a.file:
        k = http(base, a.key, 'GET', '/brand/kit?ns=' + a.ns)
        kit = k.get('kit') or {}
        print('%s: %s; logo %s; %d campaigns, %d facts, %d banned terms' % (a.ns, kit.get('name') or 'no kit', 'on file (' + str(kit.get('logoMime')) + ')' if k.get('hasLogo') else 'not on file', len(kit.get('campaigns') or []), len(kit.get('facts') or []), len(kit.get('banned') or [])))
        ink = kit.get('logoInk') or {}
        if ink:
            print('  logo ink (read from the file): %s, luminance %s, %d%% of the file is ink%s' % (ink.get('tone'), ink.get('lum'), round((ink.get('fill') or 0) * 100), ', opaque file' if ink.get('opaque') else ''))
        for x in kit.get('logoVariants') or []:
            xi = x.get('ink') or {}
            print('  logo variant %s: %s%s, version %s%s' % (x.get('variant'), x.get('tone'), (', read as ' + str(xi.get('tone'))) if xi else '', x.get('v'), ', default' if kit.get('logoDefault') == x.get('variant') else ''))
        for c in kit.get('campaigns') or []:
            vs = c.get('wordmarks') or []
            print('  campaign %s: mark policy %s, wordmark %s%s' % (c.get('id'), c.get('logoPolicy') or 'logo', 'on file' if c.get('hasWordmark') else 'not on file', ('; variants ' + ', '.join('%s (%s%s, v %s)' % (w.get('variant'), w.get('tone'), ', default' if w.get('variant') == c.get('wordmarkDefault') else '', w.get('v')) for w in vs)) if vs else ''))
            if vs and c.get('wordmarkV'):
                print('    also the older single wordmark (v %s): the Brand view reports this as a conflict; retire it with --campaign %s --wordmark --remove' % (c.get('wordmarkV'), c.get('id')))
        if not a.file:
            return
    if not os.path.isfile(a.file):
        raise SystemExit('not a file: ' + a.file)
    size = os.path.getsize(a.file)
    if size > 2 * 1024 * 1024:
        raise SystemExit('the logo is %d KB; the kit takes up to 2 MB' % (size // 1024))
    mime = mimetypes.guess_type(a.file)[0] or 'image/png'
    if mime not in ('image/png', 'image/jpeg', 'image/webp'):
        raise SystemExit('PNG, JPEG or WebP only (got %s)' % mime)
    with open(a.file, 'rb') as fh:
        b64 = base64.b64encode(fh.read()).decode()
    if a.wordmark:
        body = {'ns': a.ns, 'wordmarkB64': b64, 'wordmarkMime': mime, 'wordmarkCampaign': a.campaign}
        if a.variant:
            body['wordmarkVariant'] = a.variant; body['wordmarkTone'] = a.tone or 'colour'; body['wordmarkDefault'] = bool(a.default)
        if a.policy:
            body['logoPolicy'] = a.policy
        r = http(base, a.key, 'POST', '/brand/kit', body)
        camp = next((c for c in (r.get('kit') or {}).get('campaigns') or [] if c.get('id') == a.campaign), {})
        if a.variant:
            ent = next((w for w in camp.get('wordmarks') or [] if w.get('variant') == a.variant.lower()), {})
            print('wordmark variant %s stored for %s / %s: %s, %d KB, tone %s, version %s%s; mark policy %s' % (ent.get('variant'), a.ns, a.campaign, mime, size // 1024, ent.get('tone'), ent.get('v'), ' (default)' if camp.get('wordmarkDefault') == ent.get('variant') else '', camp.get('logoPolicy')))
            print('variants on file: ' + ', '.join(w.get('variant') for w in camp.get('wordmarks') or []))
            return
        print('wordmark stored for %s / %s: %s, %d KB, served at /brand/wordmark?ns=%s&campaign=%s; mark policy %s' % (a.ns, a.campaign, mime, size // 1024, a.ns, a.campaign, camp.get('logoPolicy')))
        print('every new composition on this campaign places it exactly from this file%s; existing versions keep their layout until re-laid out' % (' and never the client logo' if camp.get('logoPolicy') == 'wordmark' else ''))
        return
    if a.variant:
        r = http(base, a.key, 'POST', '/brand/kit', {'ns': a.ns, 'logoB64': b64, 'logoMime': mime, 'logoVariant': a.variant, 'logoTone': a.tone or 'colour', 'logoDefault': bool(a.default)})
        ent = next((x for x in (r.get('kit') or {}).get('logoVariants') or [] if x.get('variant') == a.variant.lower()), {})
        print('logo variant %s stored for %s: %s, %d KB, tone %s, version %s; the primary logo is unchanged' % (ent.get('variant'), a.ns, mime, size // 1024, ent.get('tone'), ent.get('v')))
        print('new compositions take whichever approved logo file reads on the ground under it; the browser measures and may switch between them')
        return
    r = http(base, a.key, 'POST', '/brand/kit', {'ns': a.ns, 'logoB64': b64, 'logoMime': mime})
    print('logo stored for %s: %s, %d KB, served at %s' % (a.ns, mime, size // 1024, r.get('logoUrl', '/brand/logo?ns=' + a.ns)))
    print('every new composition for this client places it exactly, bottom right (campaigns with a wordmark policy place their wordmark instead); existing versions keep their layout until re-laid out')


if __name__ == '__main__':
    main()
