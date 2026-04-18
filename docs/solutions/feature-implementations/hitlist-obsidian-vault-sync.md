---
title: "Hit List Phase 4: Obsidian vault sync via separate repo + GitHub Action"
date: 2026-04-17
category: feature-implementations
tags:
  - hit-list
  - obsidian
  - mobile-editing
  - github-actions
  - repository-dispatch
  - yaml
  - markdown-parser
  - cross-repo
  - pat
components_affected:
  - scripts/sync_hitlist_from_md.py
  - scripts/seed_hitlist_vault.py
  - scripts/validate_hitlist.mjs
  - .github/workflows/hitlist-sync.yml
  - docs/hitlist-vault-setup.md
  - docs/hitlist-vault-template.md
prs:
  - "#42"
related_solutions:
  - docs/solutions/feature-implementations/hitlist-manager-tinacms-github-commits.md
  - docs/solutions/build-errors/yaml-round-trip-timestamp-and-utf8-corruption.md
status: implemented
---

# Hit List Phase 4: Obsidian vault sync via separate repo + GitHub Action

## Problem

Phase 1 of the Hit List feature shipped a TinaCMS admin screen at `/admin` that
commits new entries to `src/data/places-hitlist.yaml` via the GitHub REST API.
Great on desktop. Unusable on mobile — the TinaCMS admin requires JS, a
keyboard, and the full dashboard UI.

Phase 4's goal: mobile-first editing without fighting the main repo's weight.

### Why not Obsidian Git directly on the main repo?

The natural first idea — open the main repo as an Obsidian vault, use the
Obsidian Git plugin to sync on save — is a non-starter:

- This repo's `.git` directory is **1.6 GB** (content + image history).
- Obsidian Git uses [isomorphic-git](https://isomorphic-git.org/), which loads
  packfile indexes into memory and consistently crashes or OOMs on repos over
  ~500 MB.
- Even if it worked, pulling 1.6 GB over mobile data on every sync would be
  abusive.

### Why not just a `hitlist.md` inside the main repo?

- Still forces mobile sync against the 1.6 GB `.git`.
- Obsidian Git would still choke.
- Working Copy and other iOS git clients fare slightly better but not reliably
  at that scale.

## Solution architecture

**Two repos, one sync direction:**

```
┌─────────────────────────┐                           ┌─────────────────────────┐
│  vault repo (private)   │                           │      main repo          │
│  ~few KB, Obsidian-safe │                           │      1.6 GB              │
│                         │                           │                         │
│  hitlist.md             │                           │  src/data/places-       │
│                         │                           │    hitlist.yaml         │
│  .github/workflows/     │  ─── repository_dispatch ─────▶ .github/workflows/   │
│    trigger-hitlist-     │       {event_type:            │   hitlist-sync.yml  │
│    sync.yml             │        hitlist-sync}          │                     │
│                         │                               │   1. Clone vault    │
│  (edits happen here     │                               │   2. Parse md→yaml  │
│   via Obsidian mobile)  │                               │   3. Validate       │
│                         │                               │   4. Commit if diff │
└─────────────────────────┘                               └─────────────────────┘
        ▲                                                           │
        │ Obsidian Git                                              │ Vercel
        │ (mobile push)                                             ▼ redeploy
```

The vault repo stays tiny and Obsidian-friendly. The main repo hosts the sync
workflow, the parser, and the canonical YAML.

**Why this shape:**
- Fine-grained PATs scoped to each half (vault read token, main-repo dispatch
  token) — minimal blast radius if either leaks
- Validator runs before the commit, so bad markdown fails the workflow and
  leaves main untouched
- `git diff` guard on the commit step means idempotent runs don't churn history

## Root cause of the non-obvious parts

### 1. YAML 1.1 vs 1.2 timestamp coercion (re-encountered)

Documented originally in [yaml-round-trip-timestamp-and-utf8-corruption.md](../build-errors/yaml-round-trip-timestamp-and-utf8-corruption.md).
The parser MUST emit `date_added` as a quoted string (e.g. `'2026-04-17'`,
not bare `2026-04-17`), because Astro's content loader uses js-yaml (YAML 1.1),
which coerces bare ISO strings to `Date` objects via the `!!timestamp` tag.
A `Date` then fails the Zod `z.string()` in `src/content.config.ts` at build
time.

PyYAML's default behavior handles this correctly — it single-quotes string
values that look like timestamps. But it's a documented gotcha, not accidental
luck. A test that round-trips `yaml → md → yaml` and re-runs the validator is
the cheapest guarantee this stays correct.

### 2. id stability across round-trips

If the vault rebuilds the YAML from scratch on every push, existing entries
would get new ids if their names changed slugification rules. That's a
breaking change for anything that references an id (the `jameschang.co /now`
page in Phase 3, map deep-links, etc.).

Fix: the parser respects `- id: xxx` overrides, and the seeder (`seed_hitlist_vault.py`)
emits every existing entry's id explicitly. Round-trip stays stable. When a
user adds a new entry and omits `id:`, it's slugified from the name once and
then round-trips forever after.

### 3. Trigger semantics

`repository_dispatch` vs a scheduled cron vs `workflow_call`:

- **Scheduled cron** would add 5-minute-to-1-hour latency between a mobile
  save and Vercel redeploy. Unusable.
- **`workflow_call`** requires the vault repo to have the main repo's
  workflow file paths hardcoded — tight coupling.
- **`repository_dispatch`** is the GitHub-native fan-out: the vault pushes
  an event of a type we choose (`hitlist-sync`), with optional client payload
  (the markdown path). Main repo listens for that type. Clean seam; either
  side can change internals without breaking the other.

Dispatch requires Contents write on the target repo, but only Actions trigger
scope — the fine-grained PAT for this has `Actions: Read and write` on the
main repo only, nothing else.

## Implementation details

### Parser — `scripts/sync_hitlist_from_md.py`

Schema designed for thumb-typing in Obsidian:

```markdown
## Miopane, Pasadena
Taiwanese bakery, Roman-style pizza.
- priority: 1
- tags: bakery, taiwanese
- yelp: https://...
```

Rules:
- `## Name, City` header starts an entry. Comma splits name from city
  via `rpartition(",")` so names containing commas (e.g. `Ma's, Pasadena`)
  still work — only the **last** comma is the separator.
- Lines until the first `- key:` become the notes paragraph.
- `- key: value` bullets set metadata. Recognized keys: `priority`,
  `neighborhood`, `tags` (comma-separated), `date_added`, `id` (override);
  plus link keys: `yelp`, `google`, `instagram`, `resy`, `opentable`, `website`.
- Unknown keys silently dropped so the schema can evolve without breaking builds.
- `id` derived from slugifying `name` if not overridden.
- `priority` defaults to `2`, `date_added` defaults to today, `links` and
  `tags` omitted from YAML when empty.

### Seeder — `scripts/seed_hitlist_vault.py`

One-command initialization of the vault repo. Reads
`src/data/places-hitlist.yaml`, emits the same entries as vault markdown with
explicit `- id:` overrides. Validated round-trip: the existing 11 entries
survive `yaml → md → yaml` and re-pass the schema validator; diff is purely
cosmetic quote styling.

### Workflow — `.github/workflows/hitlist-sync.yml`

Key steps:

```yaml
on:
  repository_dispatch:
    types: [hitlist-sync]
  workflow_dispatch:
    inputs:
      vault_path:
        description: "Path to the markdown file in the vault repo"
        default: "hitlist.md"

steps:
  - uses: actions/checkout@v4
  - name: Clone vault repo
    run: git clone --depth 1 "https://x-access-token:${VAULT_READ_TOKEN}@github.com/${VAULT_REPO}.git" /tmp/vault
  - name: Parse markdown → YAML
    run: python3 scripts/sync_hitlist_from_md.py "${{ steps.vault.outputs.path }}" src/data/places-hitlist.yaml
  - name: Validate YAML
    run: node scripts/validate_hitlist.mjs src/data/places-hitlist.yaml
  - name: Commit and push if changed
    run: |
      if git diff --quiet src/data/places-hitlist.yaml; then
        echo "No changes to commit"
        exit 0
      fi
      git add src/data/places-hitlist.yaml
      git commit -m "Sync hit list from vault $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      git push
```

Validator step uses the existing `scripts/validate_hitlist.mjs` (js-yaml based
— matches Astro's content loader semantics, the parser-parity point above).

### Docs

- `docs/hitlist-vault-setup.md` — six-step manual setup the user runs once
- `docs/hitlist-vault-template.md` — sample markdown showing the schema

## Prevention / best practices

### Test the round-trip as part of any parser change

The single cheapest guarantee that parser edits don't silently corrupt data:

```bash
python3 scripts/seed_hitlist_vault.py > /tmp/test.md
python3 scripts/sync_hitlist_from_md.py /tmp/test.md /tmp/round-trip.yaml
node scripts/validate_hitlist.mjs /tmp/round-trip.yaml
diff src/data/places-hitlist.yaml /tmp/round-trip.yaml  # expect cosmetic-only
```

If the diff ever introduces semantic changes, the parser has regressed.

### PAT rotation calendar

Fine-grained PATs expire. Two in this architecture:

| PAT | Stored in | Scope | Suggested expiry |
|---|---|---|---|
| `VAULT_READ_TOKEN` | main repo secrets | Contents: Read on vault repo only | 90 days |
| `MAIN_REPO_DISPATCH_TOKEN` | vault repo secrets | Actions: Read+Write on main repo only | 90 days |

Set calendar reminders. On rotation, revoke the old token first (workflow
fails loudly, you know it's time).

### Don't bypass the validator

The validator step is load-bearing — it uses the same parser (js-yaml) that
Astro's content loader uses, so a pass here guarantees Astro will accept the
file. If you ever see a commit where the validator was skipped with
`continue-on-error` or similar, revert it.

### If the vault grows beyond hit list

The parser + workflow are hit-list-specific today. If you later want to sync
other content from the vault (e.g., a blog-post draft checklist), prefer a
second workflow file with its own event type (`blog-draft-sync`) over
retrofitting multi-purpose handling into `hitlist-sync.yml`. Keeps each
pipeline independently debuggable.

## Related solutions

- [Hit List Manager: TinaCMS Screen Plugin with Direct GitHub API Commits](./hitlist-manager-tinacms-github-commits.md) —
  Phase 1 admin UI that commits via browser-side REST API. Phase 4 sits
  alongside it; both write to the same YAML, both run through the same
  `validate_hitlist.mjs` gate.
- [YAML Round-Trip Bugs: timestamp coercion + UTF-8 mojibake](../build-errors/yaml-round-trip-timestamp-and-utf8-corruption.md) —
  The parser-parity lesson the vault sync was built on. Mandatory read
  before touching any code that reads or writes `places-hitlist.yaml`.
- [Content Stats Dashboard & Batch Post Enrichment](./stats-dashboard-and-batch-enrichment.md) —
  Precedent for build-time data endpoints; the validator pattern used here
  is a smaller cousin.

## Follow-ups

- User-side setup is pending (create vault repo, two PATs, Obsidian Git on
  mobile). Documented in `docs/hitlist-vault-setup.md`.
- Post-setup: instrument a success/failure webhook or Slack notification on
  the workflow so failures don't silently sit in the Actions tab.
- Consider porting the retry-with-rebase pattern from `instagram-sync.yml` if
  push conflicts ever occur (unlikely given how infrequent these commits will
  be, but trivial to add).
