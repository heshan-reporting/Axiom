# Switching on AXIOM — Cloudflare dashboard setup (no terminal)

Everything AXIOM does — the permanent archive, the Sentinel, access roles, the
memory bank — is already written and deployed. It stays dormant until the
storage exists behind it. This is that setup, done by clicking.

About 20 minutes. Nothing here can break what is already running: until each
resource is connected, the routes that need it return a clear message and the
rest of AXIOM behaves exactly as it does today.

---

## Read this once: everything gets TWO names

| The thing itself | The label the code uses |
|---|---|
| `axiom-mind-db`, `axiom-mind-docs`, `axiom-mind` | `MIND_DB`, `MIND_DOCS`, `MIND_VECTORS`, `AI` |
| Lowercase, numbers, hyphens. Cloudflare enforces it. | Capitals and underscores. |
| Typed when you **create** the database / bucket / index. | Typed later, on a different screen, when you **connect** it under Settings → Bindings. |

They are never the same word. If Cloudflare says *"can only contain lowercase
letters"*, you are on a create screen and want the left-hand name.

---

# PART A — the essentials

Six steps. After these, AXIOM is genuinely live: permanent archive, Sentinel,
access keys. Parts B and C add to it afterwards.

## 1. Create the database

**dash.cloudflare.com → Storage & Databases → D1 SQL Database → Create database**

- Name: `axiom-mind-db`
- Location: leave Automatic → Create

**You never write any SQL.** AXIOM builds its own tables — the archive, the
conversation log, the alert ledger — the first time each is needed. An empty
database is exactly what it wants.

## 2. Connect it to the worker

**Workers & Pages → newsaus → Settings → Bindings → Add → D1 database**

- Variable name: `MIND_DB`   ← capitals, exactly
- Database: `axiom-mind-db`
- Save (the worker redeploys itself in seconds)

The name is the wiring. `MIND_DB` works; `mind_db` silently does nothing.

## 3. Add your keys

**Settings → Variables and Secrets → Add** — set the type to **Secret**, not Text.

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your Claude API key |
| `GEMINI_KEY` | your Gemini API key |
| `AXIOM_KEYS` | the roster below, on one line |

```json
{"LONG_RANDOM_STRING":{"n":"Heshan","r":"full"},
 "ANOTHER_ONE":{"n":"Steve","r":"read"},
 "AND_ANOTHER":{"n":"Laura","r":"full"}}
```

- `full` — can do everything.
- `read` — sees every alert, metric and search result but cannot change
  anything; writes are refused and the buttons disappear in the app. Execs.

Use any password generator, 30+ characters, one per person. The name beside
each key is what appears against acknowledged alerts.

## 4. Update the worker code

**Workers & Pages → newsaus → Edit code**

Select all in the editor, delete, paste the full contents of
`axiomworkerv4.js`, then **Deploy**.

This activates 80+ sources including the government feeds, the permanent
archive, conversation capture, the Sentinel and the access gate.

*`wrangler.toml` does not apply on this path* — it only matters when deploying
from a terminal. Deploying from the dashboard, bindings and secrets live on the
worker itself.

## 5. Set the schedule

**Settings → Triggers → Cron Triggers → Add**

- Expression: `7,37 * * * *`

Twice an hour. Each run archives the wire, sweeps social and forums, takes a
time-series reading and runs a Sentinel scan — whether or not anyone has the
app open.

**Delete any other trigger** (e.g. an old "Runs 9 PM"). A worker has one
scheduled handler, so every trigger runs the identical code — an extra one is
pure duplication.

## 6. Check that it worked

| Check | What you should see |
|---|---|
| Open `/archive/stats` on the worker URL | `"ok":true` with counts. Still `mind_unbound`? The step-2 binding name is wrong. |
| AXIOM → Settings → Access key | Paste your key, save. Mind, archive and Sentinel unlock. |
| AXIOM → Sentinel → Scan now | Runs the first sweep. "No spikes right now" is a correct, healthy answer. |

An empty alert list on day one is expected — the Sentinel compares today
against a fortnight of history it has not collected yet.

---

# PART B — the memory bank

Semantic recall: the layer that lets a brief draw on your playbooks, past
campaigns and outcomes rather than just the live wire. Part A keeps working
without any of this.

## 7. Turn on Workers AI

**Unlike everything else, there is nothing to create first.** No "AI database",
no model to choose, no API key. You are granting the worker permission to call
Cloudflare's AI models — the binding *is* the step.

1. dash.cloudflare.com → **Workers & Pages** (some accounts label it **Compute**)
2. Click **newsaus**
3. **Settings** tab
4. Scroll to **Bindings** → **+ Add binding**
5. Choose **Workers AI** from the list of types
6. One field appears — Variable name: `AI` (two letters, capitals)
7. **Add binding**

The worker's code reads `env.AI` when it turns a sentence into numbers. That
variable name is the connection.

*Can't see Workers AI in the list?* Click **AI** once in the left sidebar —
visiting it activates it — then return to Bindings.

## 8. Create the document store

**8a — create it:** Storage & Databases → R2 → Create bucket
- Bucket name: `axiom-mind-docs`  ← lowercase; Cloudflare rejects anything else

**8b — connect it:** Workers & Pages → newsaus → Settings → Bindings → Add → R2 bucket
- Variable name: `MIND_DOCS`  ← capitals here; different field, different rules
- R2 bucket: pick `axiom-mind-docs` from the list

Holds the original of every document you feed in — briefs, decks, PDFs — so the
full text stays recoverable, not just the searchable fragments.

## 9. Create the search index

**The Cloudflare dashboard is read-only for Vectorize.** It lists indexes but
has no create button — indexes are made via wrangler or the API only. Nothing
you click will find it.

**9a — create it.** From any folder (no repo or files needed):

```
npx wrangler login
npx wrangler vectorize create axiom-mind --dimensions=768 --metric=cosine
```

`npx` fetches wrangler temporarily; `login` opens a browser to authorise.
Needs Node.js — nodejs.org LTS if `npx` is not recognised.

If something else offers to create it for you, give it exactly:

| Field | Value |
|---|---|
| Index name | `axiom-mind` |
| Dimensions | `768` |
| Metric | `cosine` |

**768 is not a guess.** AXIOM embeds with `@cf/baai/bge-base-en-v1.5`, which
outputs 768 dimensions. Dimensions and metric are permanent — a wrong value
means the index connects and then silently never returns a sensible result.
(Note `bge-large-en-v1.5` is 1024; ours is the **base** model.)

**9b — connect it:** Workers & Pages → newsaus → Settings → Bindings → Add → Vectorize
- Variable name: `MIND_VECTORS`
- Index: pick `axiom-mind`

---

# PART C — alerts into Slack

## 10. Point the Sentinel at your channels

Create an incoming webhook per channel at **api.slack.com → Your Apps →
Incoming Webhooks**, and copy each URL.

**Storage & Databases → KV → your AXIOM namespace → Add entry**

- Key: `slack_webhooks`
- Value:

```json
{"mca":"https://hooks.slack.com/services/AAA",
 "aep":"https://hooks.slack.com/services/BBB",
 "vicnats":"https://hooks.slack.com/services/CCC",
 "_default":"https://hooks.slack.com/services/DDD"}
```

MCA spikes land in the Minerals Council channel, AEP's in the gas channel,
anything else falls to `_default`. Skip it and alerts still appear in the app —
they just will not come to you.

---

# If something looks wrong

| What you see | What it means | Fix |
|---|---|---|
| `mind_unbound` | The database is not connected | Step 2 — check the name is exactly `MIND_DB` |
| `mind_not_configured` | Part B is not done | Steps 7–9, or ignore: Part A works without them |
| `unauthorized` | No key, or one not in the roster | Paste your key in AXIOM → Settings → Access key |
| `read_only` | A read key tried to change something | Working as designed — use a `full` key |
| Sentinel never fires | No history to compare against | Load the backfill, then press Scan now |
| Sentinel fires constantly | Thresholds too loose for your wire | Tell me — it is a two-line tune |
| Cached data vanished | Worker pointed at a new KV namespace | Re-select the original namespace in Bindings |

# What runs by itself once this is done

- **Every half hour:** the wire is archived permanently, social and forums are
  swept, a time-series reading is taken, and the Sentinel checks all eleven
  client issues against their own baselines — drafting an angle and pushing it
  to Slack when one spikes.
- **Continuously:** every Analyst, Studio, Ad Lab and Composer exchange is
  retained, along with every reference page pulled in and every trend reading.
- **Measured from the first alert:** time from a story breaking to your team
  acknowledging it, and to having content drafted. That is the number on the
  Sentinel screen.
