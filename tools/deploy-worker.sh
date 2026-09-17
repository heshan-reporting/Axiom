#!/usr/bin/env bash
# deploy-worker.sh - ship axiomworkerv4.js to the live Cloudflare worker from a
# laptop terminal, without touching its bindings, vars, secrets or crons.
#
# Why not `wrangler deploy` from the repo root? The repo's wrangler.toml is a
# template: its KV id is a placeholder and the D1 / Vectorize / AI / R2
# bindings are commented out. Deploying from it would UNBIND the Mind from the
# live worker. And `wrangler init --from-dash` (pulling the live config) relies
# on the create-cloudflare scaffolder, which current npm refuses to run.
#
# So this script talks to the Workers API directly: it reads the worker's live
# settings (compatibility date, flags, every binding), uploads the new module
# with `keep_bindings` set to every binding type the worker holds, and proves
# the new code answers. Nothing about the worker changes except its code.
#
# Usage (from the repo, on the Mac):
#   tools/deploy-worker.sh              # check, read live settings, deploy, verify
#   tools/deploy-worker.sh --dry-run    # everything but the upload
# Auth (either):
#   npx wrangler login                  # the script reuses the wrangler session
#   CLOUDFLARE_API_TOKEN=...            # or an API token (template: Edit Cloudflare Workers)
# Environment (all optional):
#   CLOUDFLARE_ACCOUNT_ID  account to use (otherwise read from `wrangler whoami`)
#   AXIOM_WORKER_NAME      worker to update         (default newsaus)
#   AXIOM_WORKER_URL       its URL, for the check   (default https://newsaus.heshan-998.workers.dev)
#   AXIOM_DEPLOY_DIR       where settings and metadata are written (default ~/.axiom-deploy)
#   AXIOM_KEY              full-access key; if set, the check reads /engine/status
#   AXIOM_DEPLOY_FORCE=1   deploy even when the live worker lacks a Mind binding
# Secrets and vars are set separately, no config file needed:
#   npx wrangler secret put LINKEDIN_TOKEN --name newsaus
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO/axiomworkerv4.js"
NAME="${AXIOM_WORKER_NAME:-newsaus}"
URL="${AXIOM_WORKER_URL:-https://newsaus.heshan-998.workers.dev}"
WORK="${AXIOM_DEPLOY_DIR:-$HOME/.axiom-deploy}"
API="https://api.cloudflare.com/client/v4"
REQUIRED_BINDINGS="AXIOM_KV MIND_DB MIND_DOCS MIND_VECTORS AI"
DRY=0

die() { echo "deploy-worker: $*" >&2; exit 1; }
step() { printf '\n== %s\n' "$*"; }

for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --refresh) ;;  # kept for muscle memory: settings are read live on every run
    -h|--help) sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown flag $a (try --help)" ;;
  esac
done

command -v node >/dev/null 2>&1 || die "node is not installed (brew install node)"
command -v curl >/dev/null 2>&1 || die "curl is not installed"
[ -f "$SRC" ] || die "worker source not found at $SRC"
mkdir -p "$WORK"

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
grep -q '^export default' "$SRC" || die "expected a module worker (export default { fetch, scheduled })"
echo "syntax ok, pure ASCII, module worker, $(wc -l < "$SRC" | tr -d ' ') lines"

step "cloudflare auth"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
ACC="${CLOUDFLARE_ACCOUNT_ID:-}"
WHO=""
if [ -z "$TOKEN" ] || [ -z "$ACC" ]; then
  if command -v npx >/dev/null 2>&1; then
    WHO="$(npx wrangler whoami 2>/dev/null || true)"
    if ! printf '%s' "$WHO" | grep -qiE 'account id|logged in'; then
      echo "not logged in to wrangler; opening the browser login"
      npx wrangler login
      WHO="$(npx wrangler whoami 2>/dev/null || true)"
    fi
  fi
fi
if [ -z "$TOKEN" ]; then
  for f in "${XDG_CONFIG_HOME:-$HOME/.config}/.wrangler/config/default.toml" \
           "$HOME/Library/Preferences/.wrangler/config/default.toml" \
           "$HOME/.wrangler/config/default.toml"; do
    if [ -f "$f" ]; then
      TOKEN="$(sed -nE 's/^oauth_token[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$f" | head -1)"
      [ -n "$TOKEN" ] && break
    fi
  done
fi
[ -n "$TOKEN" ] || die "no Cloudflare credentials: run 'npx wrangler login' or export CLOUDFLARE_API_TOKEN (dash.cloudflare.com/profile/api-tokens, template 'Edit Cloudflare Workers')"
if [ -z "$ACC" ]; then
  ACC="$(printf '%s' "$WHO" | grep -oE '[0-9a-f]{32}' | head -1 || true)"
fi
if [ -z "$ACC" ]; then
  ACC="$(curl -sS -m 30 -H "Authorization: Bearer $TOKEN" "$API/accounts?per_page=5" | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{ try { const j=JSON.parse(s); const r=(j.result||[]); if (r.length===1) process.stdout.write(r[0].id); else if (r.length>1) { console.error("several accounts: " + r.map(a=>a.name+" "+a.id).join("; ")); } } catch(e){} });' || true)"
fi
[ -n "$ACC" ] || die "could not determine the account id; export CLOUDFLARE_ACCOUNT_ID (Workers & Pages overview, right-hand column)"
echo "account $ACC, worker '$NAME'"

auth() { curl -sS -m 60 -H "Authorization: Bearer $TOKEN" "$@"; }

step "reading the live settings of '$NAME'"
SETTINGS="$WORK/$NAME.settings.json"
META="$WORK/$NAME.metadata.json"
auth "$API/accounts/$ACC/workers/scripts/$NAME/settings" > "$SETTINGS" || die "could not reach the Cloudflare API"
SUMMARY="$(node -e '
  const fs = require("fs");
  const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!j.success) { console.error("API error: " + JSON.stringify(j.errors || j)); process.exit(2); }
  const r = j.result || {};
  const b = r.bindings || [];
  // secrets and plain vars are always kept, even if the settings call ever omitted them
  const types = [...new Set(b.map(x => x.type).concat(["secret_text", "plain_text"]))].sort();
  const names = b.map(x => x.name).sort();
  const meta = {
    main_module: "index.js",
    compatibility_date: r.compatibility_date || "2025-01-01",
    compatibility_flags: r.compatibility_flags || [],
    keep_bindings: types,
    keep_assets: true
  };
  if (r.observability) meta.observability = r.observability;
  fs.writeFileSync(process.argv[2], JSON.stringify(meta, null, 2));
  console.log("compatibility_date: " + meta.compatibility_date + (meta.compatibility_flags.length ? "  flags: " + meta.compatibility_flags.join(",") : ""));
  console.log("bindings (" + b.length + "): " + names.join(" "));
  console.log("binding types kept: " + types.join(" "));
' "$SETTINGS" "$META")" || die "the worker '$NAME' could not be read on account $ACC (wrong account, wrong name, or the token lacks Workers Scripts: Edit)"
echo "$SUMMARY"
FOUND=" $(echo "$SUMMARY" | sed -nE 's/^bindings \([0-9]+\): (.*)$/\1/p') "
MISSING=""
for b in $REQUIRED_BINDINGS; do
  case "$FOUND" in *" $b "*) ;; *) MISSING="$MISSING $b" ;; esac
done
if [ -n "$MISSING" ]; then
  echo "WARNING: the live worker has no binding named:$MISSING" >&2
  echo "Either this is not the AXIOM worker, or the Mind was never bound. Check Settings -> Bindings in the dashboard." >&2
  [ "${AXIOM_DEPLOY_FORCE:-0}" = 1 ] || die "refusing to deploy (set AXIOM_DEPLOY_FORCE=1 to override)"
fi

if [ "$DRY" = 1 ]; then
  step "dry run"
  echo "would upload $(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo 'the working copy') with metadata:"
  cat "$META"
  echo
  echo "dry run only; nothing was uploaded"
  exit 0
fi

step "deploying '$NAME' ($(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo 'working copy'))"
RESP="$WORK/$NAME.upload.json"
auth -X PUT "$API/accounts/$ACC/workers/scripts/$NAME" \
  -F "metadata=@$META;type=application/json" \
  -F "index.js=@$SRC;type=application/javascript+module" > "$RESP" || die "upload request failed"
node -e '
  const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (!j.success) { console.error("upload rejected: " + JSON.stringify(j.errors || j, null, 1)); process.exit(3); }
  const r = j.result || {};
  console.log("uploaded: " + (r.id || process.argv[2]) + "  modified " + (r.modified_on || "") + (r.etag ? "  etag " + r.etag.slice(0, 12) : ""));
' "$RESP" "$NAME" || die "Cloudflare rejected the upload (details above; full response in $RESP)"

step "checking the live worker"
sleep 3
PUB="$(curl -sS -m 20 "$URL/archive/stats" || true)"
echo "/archive/stats: ${PUB:0:160}"
if [ -n "${AXIOM_KEY:-}" ]; then
  code="$(curl -sS -m 20 -o "$WORK/check.json" -w '%{http_code}' -H "X-Axiom-Key: $AXIOM_KEY" "$URL/engine/status?ns=cmm" || echo 000)"
  body="$(head -c 240 "$WORK/check.json" 2>/dev/null || true)"
else
  code="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "$URL/engine/status?ns=cmm" || echo 000)"
  body="(export AXIOM_KEY to read the Engine status itself)"
fi
case "$code" in
  200|401) echo "new code is live: /engine/status answered $code"; echo "$body" ;;
  404) die "the worker still answers 404 on /engine/status - the old code is serving. Check the upload output above." ;;
  *) die "could not reach $URL (HTTP $code)" ;;
esac
echo
echo "done. Bindings, vars, secrets and crons are unchanged. New secrets go in with:"
echo "  npx wrangler secret put LINKEDIN_TOKEN --name $NAME"
echo "and plain vars (META_PAGES, LINKEDIN_ORGS) in the dashboard: Workers & Pages -> $NAME -> Settings -> Variables."
