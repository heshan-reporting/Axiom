# AXIOM — session guidance

AXIOM is an Australian political intelligence platform: a single-file frontend
(`index.html`, GitHub Pages) plus a Cloudflare Worker backend
(`axiomworkerv4.js`, deployed as `newsaus` — keep it pure ASCII). Design tokens
live in `axiom-ds.css`; `styleguide.html` documents them.

## Knowledge vault (claude-obsidian)

This repo carries a source-cited Obsidian knowledge vault for research and
client intelligence, powered by the vendored
[claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) product
(MIT — see `tools/claude-obsidian/LICENSE` and `ATTRIBUTION.md`).

- Product root (code, read-only): `tools/claude-obsidian/`
  — CLI: `python3 tools/claude-obsidian/scripts/claude-obsidian.py`
- Vault (knowledge, mutable): `knowledge/` — selected automatically via the
  root `.claude-obsidian.json`; runtime state under `knowledge/.vault-meta/`
  is gitignored.
- Skills are registered project-scoped in `.claude/skills/` (wiki, wiki-ingest,
  wiki-query, wiki-retrieve, wiki-lint, wiki-fold, wiki-mode, save,
  autoresearch, canvas, defuddle, obsidian-bases, obsidian-markdown, think,
  wiki-cli). Their product-root references are pre-resolved to
  `/home/user/Axiom/tools/claude-obsidian`.
- Cloud containers are ephemeral: vault changes only survive if committed.
  After vault-mutating operations, commit and push `knowledge/`.

### The growth loop

Curation doctrine lives in the vault: `knowledge/wiki/concepts/How We Curate.md`
(the L0–L4 funnel — apply it before treating anything as knowledge).
Reviewed notes sync into the app's retrieval layer with
`python3 tools/vault2mind.py` (dry-run; add `--apply` to push; commit
`tools/mind-sync-state.json` afterwards). Client-specific notes declare
`client: <id>` frontmatter; the default namespace is `cmm`. In-app,
Ad Lab and Studio record approved/killed verdicts to the Mind as
`kind: outcome` — wins and losses that future briefs retrieve.

## Working conventions

- Verify frontend changes with the Playwright harnesses in the session
  scratchpad when present; never break the Studio/Ad Lab conversation flows.
- Worker secrets (ANTHROPIC_API_KEY, GEMINI_KEY, CLICKUP_TOKEN, …) exist only
  in Cloudflare — never in the repo.
- Ship flow: commit on `claude/…` branch → push → fast-forward merge to
  `main` (GitHub Pages serves `main`).
