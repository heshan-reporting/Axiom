#!/usr/bin/env bash
# deploy-worker.sh - ship axiomworkerv4.js to the live Cloudflare worker from a
# laptop terminal, without touching its bindings, vars or secrets.
#
# Why not `wrangler deploy` from the repo root? The repo's wrangler.toml is a
# template: its KV id is a placeholder and the D1 / Vectorize / AI / R2
# bindings are commented out. Deploying from it would UNBIND the Mind from the
# live worker. This script instead pulls the worker's real configuration from
# the dashboard once (`wrangler init --from-dash`), drops the new code into
# that checkout, and deploys with `--keep-vars` so dashboard vars survive.
# Secrets are never downloaded and are always preserved by wrangler.
#
# Usage (from the repo, on the Mac):
#   tools/deploy-worker.sh              # pull config if needed, check, deploy, verify
#   tools/deploy-worker.sh --dry-run    # everything but the upload
#   tools/deploy-worker.sh --refresh    # re-pull the live config first (after you
#                                       #   add a binding or a var in the dashboard)
# Environment (all optional):
#   AXIOM_WORKER_NAME  worker to update            (default newsaus)
#   AXIOM_WORKER_URL   its URL, for the check      (default https://newsaus.heshan-998.workers.dev)
#   AXIOM_DEPLOY_DIR   where the pulled config lives (default ~/.axiom-deploy)
#   AXIOM_KEY          full-access key; if set, the check reads /engine/status
#   AXIOM_DEPLOY_FORCE=1  deploy even when the pulled config is missing bindings
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO/axiomworkerv4.js"
NAME="${AXIOM_WORKER_NAME:-newsaus}"
URL="${AXIOM_WORKER_URL:-https://newsaus.heshan-998.workers.dev}"
WORK="${AXIOM_DEPLOY_DIR:-$HOME/.axiom-deploy}"
DIR="$WORK/$NAME"
REQUIRED_BINDINGS="AXIOM_KV MIND_DB MIND_DOCS MIND_VECTORS AI"
REFRESH=0; DRY=0

die() { echo "deploy-worker: $*" >&2; exit 1; }
step() { printf '\n== %s\n' "$*"; }

for a in "$@"; do
  case "$a" in
    --refresh) REFRESH=1 ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown flag $a (try --help)" ;;
  esac
done

command -v node >/dev/null 2>&1 || die "node is not installed (brew install node)"
command -v npx >/dev/null 2>&1 || die "npx is not installed (comes with node)"
[ -f "$SRC" ] || die "worker source not found at $SRC"

step "checking $SRC"
node --check "$SRC" || die "the worker does not parse; fix the syntax error above before deploying"
node -e '
  const b = require("fs").readFileSync(process.argv[1]);
  let line = 1;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 10) line++;
    if (b[i] > 127) { console.error("non-ASCII byte 0x" + b[i].toString(16) + " on line " + line); process.exit(1); }
  }
' "$SRC" || die "the worker must stay pure ASCII"
echo "syntax ok, pure ASCII, $(wc -l < "$SRC" | tr -d ' ') lines"

step "cloudflare login"
if ! npx wrangler whoami >/dev/null 2>&1; then
  npx wrangler login
fi
npx wrangler whoami 2>/dev/null | grep -iE 'account|email|logged' | head -3 || true

if [ "$REFRESH" = 1 ] || [ ! -d "$DIR" ]; then
  step "pulling the live configuration of '$NAME' into $DIR"
  rm -rf "$DIR"
  mkdir -p "$WORK"
  ( cd "$WORK" && npx wrangler init "$NAME" --from-dash "$NAME" -y )
  [ -d "$DIR" ] || die "wrangler did not create $DIR; run it by hand: cd $WORK && npx wrangler init $NAME --from-dash $NAME"
else
  echo "using the configuration pulled earlier into $DIR (pass --refresh after changing bindings or vars in the dashboard)"
fi

CFG=""
for f in wrangler.jsonc wrangler.json wrangler.toml; do
  if [ -f "$DIR/$f" ]; then CFG="$DIR/$f"; break; fi
done
[ -n "$CFG" ] || die "no wrangler config found in $DIR"

step "verifying the pulled configuration ($CFG)"
MAIN="$(sed -nE 's/^[[:space:]]*"?main"?[[:space:]]*[:=][[:space:]]*"([^"]+)".*/\1/p' "$CFG" | head -1)"
[ -n "$MAIN" ] || MAIN="src/index.js"
[ -f "$DIR/$MAIN" ] || die "entry file $DIR/$MAIN is missing; the pulled config names main=$MAIN"
FOUND="$(sed -nE 's/.*"?binding"?[[:space:]]*[:=][[:space:]]*"([A-Za-z_][A-Za-z0-9_]*)".*/\1/p' "$CFG" | sort -u | tr '\n' ' ')"
echo "entry: $MAIN"
echo "bindings: ${FOUND:-none}"
MISSING=""
for b in $REQUIRED_BINDINGS; do
  case " $FOUND " in *" $b "*) ;; *) MISSING="$MISSING $b" ;; esac
done
if [ -n "$MISSING" ]; then
  echo "WARNING: the pulled config has no binding for:$MISSING" >&2
  echo "Deploying from it would detach those from the live worker. Check the worker's" >&2
  echo "Settings -> Bindings in the dashboard, then rerun with --refresh." >&2
  [ "${AXIOM_DEPLOY_FORCE:-0}" = 1 ] || die "refusing to deploy (set AXIOM_DEPLOY_FORCE=1 to override)"
fi

step "placing the new code"
cp "$SRC" "$DIR/$MAIN"
echo "copied axiomworkerv4.js -> $DIR/$MAIN ($(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo 'no git'))"

if [ "$DRY" = 1 ]; then
  step "dry run"
  ( cd "$DIR" && npx wrangler deploy --dry-run --keep-vars )
  echo "dry run only; nothing was uploaded"
  exit 0
fi

step "deploying '$NAME'"
( cd "$DIR" && npx wrangler deploy --keep-vars )

step "checking the live worker"
sleep 3
PUB="$(curl -sS -m 20 "$URL/archive/stats" || true)"
echo "/archive/stats: ${PUB:0:160}"
if [ -n "${AXIOM_KEY:-}" ]; then
  code="$(curl -sS -m 20 -o /tmp/axiom-deploy-check.json -w '%{http_code}' -H "X-Axiom-Key: $AXIOM_KEY" "$URL/engine/status?ns=cmm" || echo 000)"
  body="$(head -c 240 /tmp/axiom-deploy-check.json 2>/dev/null || true)"
else
  code="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "$URL/engine/status?ns=cmm" || echo 000)"
  body="(set AXIOM_KEY to read the Engine status itself)"
fi
case "$code" in
  200|401) echo "new code is live: /engine/status answered $code"; echo "$body" ;;
  404) die "the worker still answers 404 on /engine/status - the old code is serving. Check the deploy output above." ;;
  *) die "could not reach $URL (HTTP $code)" ;;
esac
echo
echo "done. Next: set any new vars (META_PAGES, LINKEDIN_ORGS) and secrets (LINKEDIN_TOKEN) with:"
echo "  cd $DIR && npx wrangler secret put LINKEDIN_TOKEN"
echo "then rerun with --refresh so the pulled config picks up new vars."
