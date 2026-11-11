#!/usr/bin/env python3
"""
reach_social.py - Facebook, Instagram and YouTube for the monitoring desk,
read on this Mac through agent-reach (layer 2 of DEN.md).

agent-reach (github.com/Panniantong/Agent-Reach) drives a browser that a person
has signed in to. This module asks it for what a signed-in member of the public
can see and hands the posts to the worker's POST /signals/ingest, where the
rules live (relevance, the Australian gate, one row a post, who may be named).

READ THIS FIRST (11 November 2026, the first run on the owner's Mac): Agent Reach v1.5.0 as installed there has NO
`facebook`, `instagram`, `youtube` or `login` command. Its commands are setup, install, configure, doctor, uninstall,
skill, format, transcribe, check-update, watch and version: it checks and installs other tools, it does not search.
So the command form this module was written to (`agent-reach <channel> <action>`, one line of JSON) was read from
documentation and has never been seen to exist. `status()` now reads the real `agent-reach doctor` text and the real
`agent-reach --help` (fixtures in tests/fixtures/den/), reports a channel with no command as `no_command`, and offers
nothing. Until a backend that really answers is chosen by the owner, this layer collects nothing - by design.

What each channel was expected to do through agent-reach, as its documentation was read
(11 November 2026 - NOT confirmed by the installed tool):
  facebook   search posts by keyword              no comments, no page timeline
  instagram  a named account's recent posts       no comments, no post search, no hashtags
  youtube    search videos by keyword             comments and captions are read by the worker afterwards

Rules this module keeps, none of them optional:
  - Public content only. It reads search results and public accounts. It has no
    code path for a group, a private account, a message or a story.
  - A person signs in, by hand: `python3 tools/reach-agent.py --login facebook`.
    This module never sees a password and never reads the browser's cookies.
  - It reads at a person's pace (never under ten seconds between two reads on a
    platform, as agent-reach asks), inside a daily cap, one read at a time.
  - It stops when the platform objects. A login wall is "<platform>_unavailable";
    a captcha or a verification demand is "<platform>_challenge" and pauses that
    platform for 24 hours. It never retries past either, never solves a captcha,
    never switches account or backend.
  - Nothing that names a person leaves this machine: the `author` agent-reach
    returns is never read. The worker names a registered public actor from its
    own register, and nobody else.
  - A page it cannot read is a failure with its reason ("parse_failed"), never a
    quiet day. Three in a row pause the platform.

Settings: ~/.axiom-reach/reach.json   {"facebook": {"enabled": true, "pace": 12, "per_run": 30, "per_day": 120, "per_query": 10}, ...}
State:    ~/.axiom-reach/state.json   reads today, pauses, who switched a platform on and when.

Run one platform by hand (the agent does this when the app asks):
  python3 tools/reach_social.py facebook --ns aep --key $AXIOM_KEY [--dry-run --out rows.json]
  python3 tools/reach_social.py --status
"""
import argparse, json, os, re, shutil, subprocess, sys, time, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from den_permalink import canon_permalink

WORKER = 'https://newsaus.heshan-998.workers.dev'
BIN = 'agent-reach'
HOME = os.path.expanduser(os.environ.get('AXIOM_REACH_HOME', '~/.axiom-reach'))
MIN_PACE = 10.0                      # agent-reach: at least ten seconds between two searches on a platform
PAUSE_S = 24 * 3600
PARSE_FAILS_MAX = 3
# channel -> what the job is called on the bridge, the platform its rows carry, and conservative defaults
CHANNELS = {
    'facebook': {'source': 'facebook', 'platform': 'facebook', 'pace': 12, 'per_run': 30, 'per_day': 120, 'per_query': 10, 'reads': 'keyword search'},
    'instagram': {'source': 'instagram', 'platform': 'instagram', 'pace': 12, 'per_run': 40, 'per_day': 150, 'per_query': 12, 'reads': 'registered accounts\' recent posts'},
    'youtube': {'source': 'ytsearch', 'platform': 'youtube', 'pace': 10, 'per_run': 40, 'per_day': 200, 'per_query': 10, 'reads': 'keyword search'},
}
BY_SOURCE = {c['source']: name for name, c in CHANNELS.items()}
USABLE = ('ready', 'search_ready', 'unverified')
WHY = {
    'not_installed': 'agent-reach is not installed on this machine. Install it from its GitHub release (uv tool install https://github.com/Panniantong/Agent-Reach/releases/latest/download/agent-reach.zip), then run: agent-reach setup',
    'not_added': 'the channel is not added in agent-reach. Run: agent-reach add %(channel)s',
    'needs_setup': 'the channel is not set up in agent-reach. Run: agent-reach setup',
    'needs_login': 'nobody is signed in to %(channel)s in agent-reach\'s browser. A person signs in by hand: python3 tools/reach-agent.py --login %(channel)s',
    'cooldown': 'agent-reach has %(channel)s in a cooldown after the platform objected. Leave it; it clears by itself',
    'broken': 'agent-reach reports the %(channel)s channel as broken. Run: agent-reach check %(channel)s --text',
    'off': '%(channel)s is switched off in ~/.axiom-reach/reach.json on this machine',
}


class Unavailable(RuntimeError):
    """The platform cannot be read from this machine right now: not installed, not signed in, paused, switched off."""
    def __init__(self, channel, why, detail=''):
        self.channel, self.why = channel, why
        super().__init__(detail or (channel + ': ' + (WHY.get(why, why) % {'channel': channel})))


class Challenge(RuntimeError):
    """The platform asked for a verification. The platform is paused; a person clears it by hand."""
    def __init__(self, channel, detail=''):
        self.channel = channel
        super().__init__('%s asked for a verification (a captcha or a security check). The collector stopped at once and has paused %s on this machine for 24 hours. A person clears it in the browser: python3 tools/reach-agent.py --login %s%s'
                         % (channel, channel, channel, (' - ' + detail) if detail else ''))


class ParseFailed(RuntimeError):
    def __init__(self, channel, detail):
        self.channel = channel
        super().__init__('%s: %s' % (channel, detail))


class RateLimited(RuntimeError):
    def __init__(self, channel, wait):
        self.channel, self.wait = channel, wait
        super().__init__('%s asked the collector to slow down (retry after %ds)' % (channel, wait))


# ---- nothing that looks like a session leaves the machine ---------------------
_SECRET = re.compile(r'(?i)\b(sessionid|csrftoken|c_user|xs|fr|datr|sb|ds_user_id|auth_token|ct0|cookie|set-cookie|authorization|bearer|token|password|passwd)\b(\s*[=:]\s*|\s+)("?)[^\s"\';,]{6,}')
_LONG = re.compile(r'\b[A-Za-z0-9_\-%]{48,}\b')
_AUTH = re.compile(r'(?i)\b(authorization\s*[:=]|bearer)\s*(?:bearer\s+)?[^\s"\';,]{6,}')


def scrub(text):
    """Strike anything shaped like a cookie, a token or a password out of a line before it is logged or sent."""
    s = _AUTH.sub(lambda m: m.group(1) + ' [struck]', str(text))
    s = _SECRET.sub(lambda m: m.group(1) + m.group(2) + '[struck]', s)
    return _LONG.sub('[struck]', s)


# ---- settings and state -------------------------------------------------------
def _read(name):
    try:
        return json.load(open(os.path.join(HOME, name)))
    except Exception:
        return {}


def _write(name, data):
    os.makedirs(HOME, mode=0o700, exist_ok=True)
    path = os.path.join(HOME, name); tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(data, f, indent=1)
    os.chmod(tmp, 0o600); os.replace(tmp, path)


def settings(channel):
    base = dict(CHANNELS[channel]); mine = (_read('reach.json').get(channel) or {})
    cfg = {k: mine.get(k, base[k]) for k in ('pace', 'per_run', 'per_day', 'per_query')}
    cfg['pace'] = max(MIN_PACE, float(cfg['pace']))                 # the floor is not a setting
    cfg['per_run'] = max(1, int(cfg['per_run'])); cfg['per_day'] = max(1, int(cfg['per_day'])); cfg['per_query'] = max(1, min(50, int(cfg['per_query'])))
    cfg['enabled'] = mine.get('enabled', True) is not False
    return cfg


def state(channel, now=None):
    st = _read('state.json').get(channel) or {}
    day = datetime.fromtimestamp(now or time.time(), timezone.utc).strftime('%Y-%m-%d')
    if st.get('day') != day:
        st = dict(st, day=day, reads=0)
    return st


def save_state(channel, st):
    allst = _read('state.json'); allst[channel] = st; _write('state.json', allst)


def paused(channel, now=None):
    st = state(channel, now); until = float(st.get('paused_until') or 0)
    return (until, st.get('pause_reason') or '') if until > (now or time.time()) else (0, '')


def pause(channel, reason, now=None):
    st = state(channel, now); st['paused_until'] = (now or time.time()) + PAUSE_S; st['pause_reason'] = scrub(reason)[:200]; st['parse_fails'] = 0
    save_state(channel, st)


# ---- agent-reach ---------------------------------------------------------------
def installed():
    return shutil.which(BIN) is not None


def _run(cmd, timeout):
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout or '', p.stderr or ''


def run_ar(channel, action, *args, timeout=120, runner=None):
    """One agent-reach read. Returns its `items`. Raises what the answer means: Unavailable (not signed in),
    Challenge (a verification), RateLimited, ParseFailed (not the JSON it promises) or RuntimeError (its own error)."""
    if not installed() and runner is None:
        raise Unavailable(channel, 'not_installed')
    code, out, err = (runner or _run)([BIN, channel, action] + [str(a) for a in args], timeout)
    line = next((l for l in reversed(out.strip().split('\n')) if l.strip().startswith('{')), '')
    try:
        d = json.loads(line)
    except Exception:
        raise ParseFailed(channel, 'agent-reach did not answer in JSON for "%s %s" (exit %s): %s' % (channel, action, code, scrub((out or err).strip()[:160]) or 'nothing'))
    if d.get('ok') is False or d.get('error'):
        e = d.get('error') if isinstance(d.get('error'), dict) else {'code': str(d.get('error') or 'ERROR')}
        c = str(e.get('code') or '').upper(); msg = scrub(str(e.get('message') or e.get('hint') or ''))[:200]
        if c == 'NEED_LOGIN':
            raise Unavailable(channel, 'needs_login')
        if c == 'PLATFORM_BLOCKED':
            raise Challenge(channel, msg)
        if c == 'RATE_LIMITED':
            raise RateLimited(channel, int(e.get('retry_after_seconds') or d.get('retry_after_seconds') or 60))
        raise RuntimeError('%s %s: agent-reach said %s%s' % (channel, action, c or 'an error', (' - ' + msg) if msg else ''))
    items = d.get('items')
    if not isinstance(items, list):
        raise ParseFailed(channel, 'agent-reach answered without a list of items for "%s %s"' % (channel, action))
    return items


def _find_status(obj, channel):
    if isinstance(obj, dict):
        v = obj.get(channel)
        if isinstance(v, str): return v
        if isinstance(v, dict) and isinstance(v.get('status'), str): return v['status']
        if str(obj.get('name') or obj.get('channel') or obj.get('id') or '') == channel and isinstance(obj.get('status'), str): return obj['status']
        for x in obj.values():
            r = _find_status(x, channel)
            if r: return r
    elif isinstance(obj, list):
        for x in obj:
            r = _find_status(x, channel)
            if r: return r
    return ''


def status(channel, runner=None, now=None):
    """What this machine can do for a channel, checked not assumed: {installed, status, usable, enabled, paused_until, why}."""
    cfg = settings(channel); until, reason = paused(channel, now)
    out = {'channel': channel, 'source': CHANNELS[channel]['source'], 'installed': installed() or runner is not None, 'status': '', 'usable': False,
           'enabled': cfg['enabled'], 'paused_until': until, 'pause_reason': reason, 'reads_today': int(state(channel, now).get('reads') or 0), 'per_day': cfg['per_day']}
    if not out['installed']:
        out['why'] = WHY['not_installed']; return out
    try:
        code, text, err = (runner or _run)([BIN, 'doctor'], 60)
    except Exception as e:
        out['why'] = 'agent-reach doctor could not run: %s' % scrub(str(e))[:120]; return out
    st = ''
    try:
        line = next((l for l in reversed(text.strip().split('\n')) if l.strip().startswith('{') or l.strip().startswith('[')), '')
        st = _find_status(json.loads(line), channel)
    except Exception:
        st = ''
    if not st:
        m = re.search(r'(?im)^.*\b%s\b.*?\b(not_added|needs_setup|needs_login|unverified|search_ready|ready|cooldown|broken)\b' % re.escape(channel), text)
        st = m.group(1) if m else ''
    # the tool as it really answers (v1.5.0): marks in text, and a help page that says which commands exist
    cmds = commands(runner, now); marks = doctor_marks(text); mk = marks.get(channel)
    why = ''
    if cmds is not None and channel not in cmds:
        st = 'no_command'
        why = NO_COMMAND % {'channel': channel, 'have': ', '.join(sorted(cmds))}
        if mk and mk['mark'] != 'ok': why += '. Its doctor also marks %s as %s%s' % (channel, {'needs_config': 'installed but needing configuration or sign-in', 'not_installed': 'not installed', 'locked': 'not unlocked'}[mk['mark']], (': ' + mk['detail']) if mk['detail'] else '')
    elif not st and mk:
        if mk['mark'] == 'ok':
            # a tick is usable only with a command to run; help that cannot be read is not a yes
            st = 'ready' if cmds is not None else 'unreadable_help'
            if cmds is None: why = 'agent-reach doctor marks %s as usable, but `agent-reach --help` could not be read, so it is not known whether this version can search it' % channel
        else:
            st = {'needs_config': 'needs_config', 'not_installed': 'channel_not_installed', 'locked': 'channel_not_installed'}[mk['mark']]
            why = 'agent-reach doctor marks %s as %s%s' % (channel, 'installed but needing configuration or sign-in' if mk['mark'] == 'needs_config' else 'not installed', (': ' + mk['detail']) if mk['detail'] else '')
    elif not st:
        st = 'unreadable' if not marks else 'not_listed'
        why = ('the answer of `agent-reach doctor` could not be read: it is neither the marked text of v1.5.0 nor JSON. Run `agent-reach doctor` and `agent-reach --version` and send the output'
               if not marks else '`agent-reach doctor` does not mention %s at all' % channel)
    out['status'] = st
    out['usable'] = st in USABLE and cfg['enabled'] and not until
    if not cfg['enabled']: out['why'] = WHY['off'] % {'channel': channel}
    elif until: out['why'] = '%s is paused on this machine until %s: %s' % (channel, datetime.fromtimestamp(until).strftime('%d %b %H:%M'), reason)
    elif st not in USABLE: out['why'] = why or (WHY.get(st) or 'agent-reach reports the %(channel)s channel as "' + st + '"') % {'channel': channel}
    return out


def assert_ready(channel, runner=None, now=None):
    """Stop before a sweep that would return nothing and look like a quiet day."""
    st = status(channel, runner=runner, now=now)
    if st['usable']:
        return st
    why = 'not_installed' if not st['installed'] else 'off' if not st['enabled'] else 'paused' if st['paused_until'] else (st['status'] or 'unknown')
    raise Unavailable(channel, why, channel + ': ' + st.get('why', 'not usable'))


# ---- agent-reach as it really answers ------------------------------------------------------------------------------
# `agent-reach doctor` (v1.5.0) prints text, in Chinese, one line a channel:
#     "  <mark>  <channel label> - <detail>"   with the mark one of  U+2705 (usable), [!] (installed, needs
#     configuration or sign-in), [X] (not installed)
# and, for channels not unlocked at all, one sentence listing them in brackets. `doctor --text` is not accepted.
_DOCTOR_MARKS = (('\u2705', 'ok'), ('[!]', 'needs_config'), ('[X]', 'not_installed'))
_HELP_CACHE = {}


def doctor_marks(text):
    """{channel: {mark: ok|needs_config|not_installed|locked, detail}} from the real doctor text. A channel is found
    by its own name in the line's label; anything else on the page is ignored."""
    out = {}
    for line in str(text or '').split('\n'):
        l = line.strip()
        mark = next((m for sym, m in _DOCTOR_MARKS if l.startswith(sym)), None)
        if mark:
            sym = next(sym for sym, m in _DOCTOR_MARKS if l.startswith(sym))
            body = l[len(sym):].strip()
            label, _, detail = body.partition('\u2014')
            if not _: label, _, detail = body.partition(' - ')
            for c in CHANNELS:
                if re.search(r'(?i)\b%s\b' % c, label) and c not in out: out[c] = {'mark': mark, 'detail': scrub(detail.strip())[:240]}
        elif '\uff08' in l or '(' in l:
            # the sentence that lists what is still to unlock: "... (Twitter/X ..., Facebook ..., Instagram ...)"
            inner = re.search(r'[\uff08(](.+)[\uff09)]', l)
            for c in CHANNELS:
                if inner and re.search(r'(?i)\b%s\b' % c, inner.group(1)) and c not in out: out[c] = {'mark': 'locked', 'detail': ''}
    return out


def commands(runner=None, now=None):
    """The subcommands this agent-reach has, read from `agent-reach --help` ("{setup,install,...}"), or None when the
    help cannot be read. Asked once every ten minutes."""
    now = time.time() if now is None else now
    if runner is None and _HELP_CACHE.get('at') and now - _HELP_CACHE['at'] < 600: return _HELP_CACHE['v']
    try:
        code, text, err = (runner or _run)([BIN, '--help'], 30)
        m = re.search(r'\{([a-z0-9_,-]+)\}', (text or '') + '\n' + (err or ''))
        v = set(x for x in m.group(1).split(',') if x) if m else None
    except Exception:
        v = None
    if runner is None: _HELP_CACHE['at'] = now; _HELP_CACHE['v'] = v
    return v


NO_COMMAND = ('the agent-reach on this machine has no `%(channel)s` command (it has: %(have)s). It checks and installs other tools; '
              'it does not search %(channel)s, so nothing is collected here and nothing is offered to AXIOM. This is not something '
              'to fix on the Mac: the collector was written to a command form this tool does not have (DEN.md s.3)')


def offered(runner=None):
    """The bridge sources this machine can serve right now."""
    return [CHANNELS[c]['source'] for c in CHANNELS if status(c, runner=runner)['usable']]


# ---- an item from agent-reach -> a row for /signals/ingest ----------------------
_NUM = re.compile(r'^\s*([\d,.]+)\s*([kKmM]?)')
_ALIASES = {
    'likes': ('likes', 'like_count', 'likeCount', 'reactions', 'reaction_count', 'reactions_count', 'favorite_count', 'digg_count'),
    'comments': ('comments', 'comment_count', 'comments_count', 'commentCount', 'reply_count'),
    'shares': ('shares', 'share_count', 'shares_count', 'reshare_count', 'repost_count'),
    'views': ('views', 'view_count', 'viewCount', 'play_count', 'video_view_count'),
}


def _n(v):
    if isinstance(v, bool): return 0
    if isinstance(v, (int, float)): return max(0, int(v))
    if isinstance(v, dict): return _n(v.get('count') or v.get('total') or v.get('total_count'))
    m = _NUM.match(str(v or ''))
    if not m: return 0
    try:
        x = float(m.group(1).replace(',', ''))
    except Exception:
        return 0
    return int(x * {'k': 1e3, 'm': 1e6}.get(m.group(2).lower(), 1))


def _eng(item):
    raw = item.get('raw') if isinstance(item.get('raw'), dict) else {}
    out = {}
    for key, names in _ALIASES.items():
        for src in (item, raw, raw.get('stats') if isinstance(raw.get('stats'), dict) else {}, raw.get('statistics') if isinstance(raw.get('statistics'), dict) else {}):
            v = next((src[n] for n in names if n in src and src[n] not in (None, '')), None)
            if v is not None:
                out[key] = _n(v); break
    return out


def _ts(v):
    s = str(v or '').strip()
    if not s: return 0
    if re.match(r'^\d{10,13}$', s):
        n = int(s); return n * 1000 if n < 10 ** 11 else n
    try:
        d = datetime.fromisoformat(s.replace('Z', '+00:00'))
        return int((d if d.tzinfo else d.replace(tzinfo=timezone.utc)).timestamp() * 1000)
    except Exception:
        return 0


def item_row(channel, item, now_ms, q='', watch=''):
    """One agent-reach item as an ingest row, or None when it is not a post with words and an address.
    `author` is deliberately never read."""
    if not isinstance(item, dict): return None
    platform = CHANNELS[channel]['platform']; raw = item.get('raw') if isinstance(item.get('raw'), dict) else {}
    url = canon_permalink(platform, item.get('url') or raw.get('url') or raw.get('permalink') or raw.get('link') or '')
    title = str(item.get('title') or '').strip(); body = str(item.get('text') or raw.get('caption') or raw.get('description') or '').strip()
    text = (title + '\n' + body).strip() if (platform == 'youtube' and title and title not in body) else (body or title)
    if not url or len(text) < 3: return None
    row = {'platform': platform, 'url': url, 'text': text[:6000], 'eng': _eng(item), 'eng_at': now_ms}
    ts = _ts(item.get('published_at') or raw.get('created_time') or raw.get('timestamp') or raw.get('taken_at'))
    if ts: row['ts'] = ts
    if q: row['q'] = q[:120]
    if watch: row['watch'] = watch
    return row


def sweep(channel, plan, log=print, runner=None, sleep=time.sleep, clock=time.time):
    """Read what the desk's plan asks for on one channel, inside the pace and the caps. Returns (rows, stats).
    Raises Unavailable, Challenge or ParseFailed; what was read before a stop is still returned by the caller's catch."""
    cfg = settings(channel); st = state(channel, clock()); log_ = lambda k, t: log(k, scrub(t))
    left = cfg['per_day'] - int(st.get('reads') or 0); budget = min(cfg['per_run'], left)
    stats = {'reads': 0, 'items': 0, 'rows': 0, 'unusable': 0, 'held_back': 0, 'errors': []}
    if budget <= 0:
        raise Unavailable(channel, 'cap', '%s: today\'s cap of %d reads on this machine is spent; it resets at midnight UTC' % (channel, cfg['per_day']))
    p = (plan.get('plan') or {}).get(CHANNELS[channel]['platform']) or {}
    if channel == 'instagram':
        jobs = [('posts', a['value'], '', a.get('id') or '') for a in (p.get('accounts') or [])]
    else:
        jobs = [('search', q, q, '') for q in (plan.get('queries') or [])]
    stats['held_back'] = max(0, len(jobs) - budget); jobs = jobs[:budget]
    rows = {}; fails = int(st.get('parse_fails') or 0); now_ms = int(clock() * 1000); first = True
    try:
        for action, arg, q, watch in jobs:
            if not first: sleep(cfg['pace'])
            first = False
            log_('cmd', '%s %s %s "%s" --limit %d' % (BIN, channel, action, arg, cfg['per_query']))
            try:
                items = run_ar(channel, action, arg, '--limit', cfg['per_query'], runner=runner)
            except RateLimited as e:
                log_('err', str(e)); stats['errors'].append(str(e)); break          # slow down means stop for this run
            except ParseFailed as e:
                fails += 1; stats['errors'].append(str(e)); log_('err', str(e))
                if fails >= PARSE_FAILS_MAX:
                    pause(channel, 'three answers in a row could not be read', clock()); fails = 0
                    raise ParseFailed(channel, 'three answers in a row could not be read, so %s is paused on this machine for 24 hours. The page or agent-reach changed: run agent-reach check %s --text, then update agent-reach. Last: %s' % (channel, channel, str(e)[:160]))
                continue
            finally:
                st['reads'] = int(st.get('reads') or 0) + 1; stats['reads'] += 1
            got = [r for r in (item_row(channel, it, now_ms, q=q, watch=watch) for it in items) if r]
            stats['items'] += len(items); stats['unusable'] += len(items) - len(got)
            if items and not got:
                fails += 1; msg = '%s %s "%s": %d items came back and none had both an address and words - the shape of the answer has changed' % (channel, action, arg, len(items))
                stats['errors'].append(msg); log_('err', msg)
                if fails >= PARSE_FAILS_MAX:
                    pause(channel, 'three answers in a row could not be read', clock()); fails = 0
                    raise ParseFailed(channel, 'three answers in a row had nothing readable, so %s is paused on this machine for 24 hours. Run agent-reach check %s --text, then update agent-reach.' % (channel, channel))
                continue
            fails = 0
            for r in got: rows[r['url']] = r
            log_('out', '%d items, %d posts' % (len(items), len(got)))
    except Challenge as e:
        pause(channel, 'the platform asked for a verification', clock())
        raise
    finally:
        cur = state(channel, clock()); cur['reads'] = int(st.get('reads') or 0); cur['parse_fails'] = fails
        save_state(channel, cur)
    stats['rows'] = len(rows)
    return list(rows.values()), stats


# ---- the worker ------------------------------------------------------------------
def http_json(url, key, body=None, timeout=60):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET',
                                 headers={'X-Axiom-Key': key, 'Content-Type': 'application/json', 'User-Agent': 'axiom-reach/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or '{}')


def desks(worker, key, params, http=http_json):
    ns = params.get('ns')
    if ns: return [str(x).lower() for x in (ns if isinstance(ns, list) else str(ns).split(',')) if str(x).strip()]
    d = http(worker.rstrip('/') + '/reddit/issues', key)
    seen = []
    for i in d.get('issues') or []:
        if i.get('ns') and i['ns'] not in seen: seen.append(i['ns'])
    return seen


def collect(channel, worker, key, params, log, http=http_json, runner=None, sleep=time.sleep, clock=time.time):
    """The job: for each desk, read its plan, sweep the channel, hand the posts to /signals/ingest."""
    assert_ready(channel, runner=runner, now=clock())
    platform = CHANNELS[channel]['platform']
    out = {'ok': True, 'platform': platform, 'layer': 2, 'desks': 0, 'reads': 0, 'found': 0, 'threads': 0, 'threadRows': 0, 'updated': 0, 'comments': 0, 'commentRows': 0,
           'skipped': {'off_topic': 0, 'foreign': 0, 'bad_url': 0}, 'held_back': 0, 'errors': []}
    for ns in desks(worker, key, params, http):
        plan = http(worker.rstrip('/') + '/den/plan?ns=%s&platform=%s' % (ns, platform), key)
        if not plan.get('ok'):
            out['errors'].append('%s: %s' % (ns, plan.get('detail') or plan.get('error'))); continue
        p = (plan.get('plan') or {}).get(platform) or {}
        if not ((p.get('accounts') if channel == 'instagram' else plan.get('queries')) or []):
            continue
        out['desks'] += 1
        log('info', '%s for %s: %s' % (platform, ns, CHANNELS[channel]['reads']))
        rows, stats = sweep(channel, plan, log=log, runner=runner, sleep=sleep, clock=clock)
        out['reads'] += stats['reads']; out['found'] += stats['rows']; out['held_back'] += stats['held_back']; out['errors'] += stats['errors'][:3]
        for i in range(0, len(rows), 400):
            r = http(worker.rstrip('/') + '/signals/ingest', key, {'ns': ns, 'layer': 2, 'via': 'reach', 'rows': rows[i:i + 400]})
            if not r.get('ok'):
                raise RuntimeError('the worker refused the posts for %s: %s - %s' % (ns, r.get('error'), r.get('detail')))
            out['threads'] += int(r.get('kept') or 0); out['threadRows'] += int(r.get('inserted') or 0); out['updated'] += int(r.get('updated') or 0)
            for k in out['skipped']: out['skipped'][k] += int((r.get('skipped') or {}).get(k) or 0)
        log('out', '%s: %d posts read, the worker kept %d' % (ns, stats['rows'], out['threads']))
    out['errors'] = [scrub(e) for e in out['errors'][:6]]
    out['summary'] = '%s: %d reads for %d desks, %d posts found, %d kept (%d new, %d refreshed); %d off the desks\' topics, %d not Australian%s' % (
        platform, out['reads'], out['desks'], out['found'], out['threads'], out['threadRows'], out['updated'], out['skipped']['off_topic'], out['skipped']['foreign'],
        ('; %d reads held back by the cap' % out['held_back']) if out['held_back'] else '')
    if out['reads'] and not out['found'] and out['errors']:
        out['ok'] = False; out['error'] = platform + '_parse_failed'; out['detail'] = 'Reads were made and nothing could be read from the answers. ' + out['errors'][0]
    return out


# ---- signing in: a person's act ---------------------------------------------------
WARNING = '''
  Before you sign in to %(channel)s for collection, read this.

  - Reading a platform with a signed-in account and a program is against %(channel)s's terms.
    The account used can be challenged, restricted or closed.
  - NEVER use a profile that administers a client's ad account, Page or Business
    asset. If that profile is restricted, the agency is locked out of client work.
    agent-reach itself recommends a secondary account.
  - This collector reads public content only, at a person's pace, and stops the
    moment the platform asks for a verification. It never solves a captcha.
  - You sign in yourself, in the window that opens. This tool never sees the password.
'''


def login(channel, ask=input, out=print, call=None, who=None, runner=None):
    """Show what signing in means, ask the question that matters, then let agent-reach open its sign-in window."""
    if channel not in CHANNELS: raise SystemExit('unknown platform "%s": one of %s' % (channel, ', '.join(CHANNELS)))
    cmds = commands(runner) if (runner is not None or installed()) else None
    if cmds is not None and ('login' not in cmds or channel not in cmds):
        out('  Stopped before anything was asked: the agent-reach on this machine has no `login` command and no `%s` command (it has: %s), so there is nothing to sign in to and nothing would be collected. Nothing was switched on.' % (channel, ', '.join(sorted(cmds))))
        return False
    out(WARNING % {'channel': channel})
    if channel in ('facebook', 'instagram'):
        a = ask('  Does the profile you are about to use administer any client ad account, Page or Business asset? (yes/no): ').strip().lower()
        if a != 'no':
            out('  Stopped. Use a profile that administers nothing of a client\'s.' if a == 'yes' else '  Stopped: the answer has to be no before this goes further.'); return False
    if ask('  Type the platform\'s name to switch collection on for it on this Mac: ').strip().lower() != channel:
        out('  Stopped: nothing was switched on.'); return False
    if not installed() and call is None:
        out('  ' + WHY['not_installed']); return False
    rc = (call or subprocess.call)([BIN, 'login', channel])
    if rc != 0:
        out('  agent-reach login did not finish (exit %s). Nothing was switched on.' % rc); return False
    st = state(channel); st['switched_on'] = {'by': who or os.environ.get('USER', ''), 'at': int(time.time())}; st.pop('paused_until', None); st.pop('pause_reason', None); st['parse_fails'] = 0
    save_state(channel, st)
    out('  %s is switched on for collection on this Mac. Tell the owner, so it is recorded: %s, %s.' % (channel, st['switched_on']['by'] or 'someone', datetime.now().strftime('%d %B %Y')))
    return True


def main(argv=None):
    ap = argparse.ArgumentParser(description='Facebook, Instagram and YouTube through agent-reach, for one desk')
    ap.add_argument('channel', nargs='?', choices=sorted(CHANNELS)); ap.add_argument('--ns'); ap.add_argument('--key', default=os.environ.get('AXIOM_KEY', ''))
    ap.add_argument('--worker', default=WORKER); ap.add_argument('--status', action='store_true'); ap.add_argument('--dry-run', action='store_true'); ap.add_argument('--out')
    a = ap.parse_args(argv)
    if a.status or not a.channel:
        for c in CHANNELS:
            s = status(c)
            print('%-10s %-13s %s%s' % (c, 'usable' if s['usable'] else (s['status'] or 'not installed'), '%d of %d reads today' % (s['reads_today'], s['per_day']), ('  - ' + s['why']) if s.get('why') else ''))
        return 0
    if not a.key: sys.exit('need --key or AXIOM_KEY')
    log = lambda k, t: print(('  ' if k == 'out' else '') + scrub(t), flush=True)
    try:
        if a.dry_run:
            assert_ready(a.channel)
            plan = http_json(a.worker.rstrip('/') + '/den/plan?ns=%s&platform=%s' % (a.ns, CHANNELS[a.channel]['platform']), a.key)
            rows, stats = sweep(a.channel, plan, log=log)
            payload = {'ns': a.ns, 'layer': 2, 'via': 'reach', 'rows': rows}
            if a.out: json.dump(payload, open(a.out, 'w'), indent=1)
            print('%d posts read in %d reads (nothing was sent)%s' % (len(rows), stats['reads'], (' -> ' + a.out) if a.out else '')); return 0
        r = collect(a.channel, a.worker, a.key, {'ns': a.ns} if a.ns else {}, log)
        print(r['summary']); return 0 if r['ok'] else 1
    except (Unavailable, Challenge, ParseFailed) as e:
        sys.exit(scrub(str(e)))


if __name__ == '__main__':
    sys.exit(main())
