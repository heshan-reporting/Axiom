# AXIOM — install & setup

Everything AXIOM has learned to do (the permanent archive, The Curious Mind,
the Sentinel, historical backfill, access roles) is written and shipped, but
it is **inert until the Cloudflare resources exist**. This is the one-time
setup, start to finish, about 20 minutes.

Nothing here can break what is already running: until each resource is bound,
the routes that need it return a clear `501` and the rest of AXIOM behaves
exactly as it does today.

---

## 0. Before you start

```bash
npm install -g wrangler     # or: npx wrangler <command>
wrangler login              # opens a browser, authorises your Cloudflare account
wrangler whoami             # confirms which account you are on
```

Work from the repo root (the folder holding `axiomworkerv4.js`).

> **The worker name must stay `newsaus`.** That is what makes `wrangler deploy`
> *update* your existing worker and keep its secrets, KV data and custom
> domain, rather than creating a second one.

---

## 1. Point the config at your EXISTING KV namespace

This protects your cached data (`pulse_history`, feed circuit-breaker,
`/allnews` caches). Find the id:

```bash
wrangler kv namespace list
```

Look for the namespace your worker already uses (title usually contains
`AXIOM_KV` or `newsaus`), copy its `id`, and paste it into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "AXIOM_KV"
id = "abc123...your-real-id..."     # replaces PASTE_EXISTING_NAMESPACE_ID
```

*Dashboard route:* Workers & Pages → KV → the id is in the list.

---

## 2. Create the three storage resources (once, ever)

```bash
# 1. Vector index — semantic memory. 768 dims to match the bge embedding model.
wrangler vectorize create axiom-mind --dimensions=768 --metric=cosine

# 2. SQL database — the permanent archive, conversations and Sentinel alerts.
wrangler d1 create axiom-mind-db

# 3. Object store — original uploaded documents.
wrangler r2 bucket create axiom-mind-docs
```

`wrangler d1 create` prints a `database_id`. **Copy it** — you need it in
step 3.

*Dashboard route:* Storage & Databases → D1 / Vectorize / R2 → Create.

---

## 3. Uncomment the bindings in `wrangler.toml`

Delete the leading `# ` from this block and paste your D1 id:

```toml
[[vectorize]]
binding = "MIND_VECTORS"
index_name = "axiom-mind"

[ai]
binding = "AI"

[[d1_databases]]
binding = "MIND_DB"
database_name = "axiom-mind-db"
database_id = "paste-the-id-d1-create-printed"

[[r2_buckets]]
binding = "MIND_DOCS"
bucket_name = "axiom-mind-docs"
```

*Dashboard route:* Worker → Settings → Bindings → Add, using exactly these
binding names (`MIND_VECTORS`, `AI`, `MIND_DB`, `MIND_DOCS`). The names matter;
the worker looks them up by name.

**You do not need to create any tables.** The worker creates `arc_items`,
`arc_convo`, `arc_alerts`, `mind_docs` and `mind_runs` itself, with their
indexes, the first time each route is used.

---

## 4. Set the secrets

Each command prompts for the value and stores it encrypted. Existing secrets
survive deploys — you only set new or changed ones.

**Required for the AI features:**

```bash
wrangler secret put ANTHROPIC_API_KEY   # Analyst, Studio, Ad Lab, Sentinel angles
wrangler secret put GEMINI_KEY          # image engine + link summarisation
```

**Access control (this is what makes the private routes private):**

```bash
# Option A - one shared full-access key
wrangler secret put AXIOM_ACCESS_KEY

# Option B - per-person keys with roles (recommended for a team + execs)
wrangler secret put AXIOM_KEYS
# paste JSON on one line, e.g.
# {"9fk2...":{"n":"Heshan","r":"full"},"3ab7...":{"n":"Steve","r":"read"}}
```

`r:"full"` may write (ingest, log, acknowledge). `r:"read"` may only read
(query, search, alerts, metrics) — writes return 403 and the app hides the
buttons. Generate keys with something like
`openssl rand -hex 20`. Both options can coexist.

**Optional integrations** (skip any you do not use):

```bash
wrangler secret put CLICKUP_TOKEN
wrangler secret put GUARDIAN_KEY
wrangler secret put TVFY_KEY
wrangler secret put WA_TOKEN          # + WA_PHONE_ID for WhatsApp Cloud API
```

---

## 5. Deploy

```bash
wrangler deploy
```

This is the step that activates everything built since the last deploy: 80+
feeds including the government sources, multi-network social, the forums
route, the whole archive layer, the Sentinel, and the access gate.

*Zero-risk alternative:* paste the contents of `axiomworkerv4.js` into the
dashboard editor (Worker → Edit code → Deploy). That updates only the code and
leaves bindings and secrets untouched — but you still need steps 1–4 done in
the dashboard for the new routes to work.

---

## 6. Verify it worked

Replace `KEY` with a full-access key. Each should return JSON, not an error.

```bash
W=https://newsaus.heshan-998.workers.dev

curl -s "$W/allnews?max=5" | head -c 300                 # wire still alive
curl -s "$W/archive/stats"                               # public, aggregate only
curl -s -H "X-Axiom-Key: KEY" "$W/archive/search?limit=3"
curl -s -H "X-Axiom-Key: KEY" "$W/sentinel/alerts"       # {"ok":true,"alerts":[]}
curl -s -H "X-Axiom-Key: KEY" "$W/sentinel/metrics"
curl -s -X POST -H "X-Axiom-Key: KEY" -H "Content-Type: application/json" \
     -d '{}' "$W/sentinel/scan"                          # first live sweep
```

Check a read-only key is really read-only (should return `403 read_only`):

```bash
curl -s -X POST -H "X-Axiom-Key: READONLYKEY" -H "Content-Type: application/json" \
     -d '{"id":1}' "$W/sentinel/ack"
```

Spot-check any new feed:

```bash
curl -s "$W/rss?feed=health_gov"  | head -c 200
curl -s "$W/rss?feed=tallyroom"   | head -c 200
curl -s "$W/allnews?debug=1" | python3 -m json.tool | grep -A2 '"health"' | head -40
```

The last one reports per-feed item counts — anything sitting at 0 for a day is
a dead URL worth replacing (dead feeds fail soft; they never break a build).

---

## 7. Turn on the app side

In AXIOM → **Settings**:

- **Worker URL** — leave as is unless you deployed elsewhere.
- **Access key** — paste your personal key. Without it the private routes
  return 401 and the Mind, Sentinel and archive stay dark.
- **Claude API key** — for the in-browser Analyst.

---

## 8. Sentinel delivery (Slack)

Create an incoming webhook per client channel
(api.slack.com → Your Apps → Incoming Webhooks), then store the map in KV:

```bash
wrangler kv key put --binding=AXIOM_KV slack_webhooks \
 '{"mca":"https://hooks.slack.com/services/AAA","aep":"https://hooks.slack.com/services/BBB","_default":"https://hooks.slack.com/services/CCC"}'
```

Namespaces match the client ids (`mca`, `aep`, `vicnats`, `pca`, `mba`, `cmm`).
`_default` catches anything without its own hook. No webhook = alerts still
appear in the app, they just are not pushed.

---

## 9. Load the history and the memory

**Historical series** (gives the Sentinel real baselines instead of a thin
archive, and powers trend analysis):

```bash
python3 tools/backfill.py all --key KEY          # GDELT issue history + Wikipedia attention
python3 tools/backfill.py aec --csv HouseFirstPrefsByParty.csv --election 2022 --key KEY
python3 tools/backfill.py polls --csv polls.csv --key KEY
```

Re-runs are safe — every row is deduplicated by URL.

**Reviewed vault notes → the Mind:**

```bash
python3 tools/vault2mind.py                     # dry run, shows the plan
python3 tools/vault2mind.py --apply             # pushes
git add tools/mind-sync-state.json && git commit -m "Mind sync state"
```

**Confidential org knowledge** (never goes in the repo — straight to the Mind):

```bash
python3 tools/mind-push.py /path/to/staged-notes --key KEY --dry-run
python3 tools/mind-push.py /path/to/staged-notes --key KEY
```

---

## 10. One-time GitHub Pages setting

Settings → Pages → Branch: `main`, folder: **`/docs`** → Save.

This serves only the app. Without it the whole repo — including the knowledge
vault — is publicly fetchable under the site URL.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `mind_unbound` / `mind_not_configured` | bindings missing | steps 2–3, then redeploy |
| `401 unauthorized` | key missing or wrong | paste the key in Settings → Access key |
| `403 read_only` | read-role key attempting a write | use a `full` key |
| Sentinel fires nothing | thin archive, or genuinely quiet | run `backfill.py all`, then `POST /sentinel/scan` |
| Sentinel too noisy | thresholds too low for your wire | raise `MIN_RATIO` / `MIN_HOT` in `SENTINEL` at the top of the worker |
| A feed returns nothing | source changed its URL | check `/allnews?debug=1`, replace the URL in `AU_FEEDS` |
| KV cache vanished | deployed with a new namespace id | put the original id back in `wrangler.toml` |
| Cron not running | trigger not applied | `wrangler deploy` again; check Worker → Settings → Triggers |

## What runs automatically once this is done

- **Every 30 min:** wire snapshot → permanent archive; social + forum sweep;
  pulse time-series point; **Sentinel scan** → spike detection → drafted angle
  → Slack.
- **Continuously:** every Analyst/Studio/Ad Lab/Composer exchange, every
  fetched reference page, and every trend snapshot lands in the archive.
