---
id: DOC-020
type: runbook
status: active
phase: null
owner: james
tags: [build-deploy, admin, venue-tags, instagram]
links: [ADR-001, DOC-017, DOC-007]
updated: "2026-07-23"
---

# Runbook

How to operate this thing. Written for **you, six months from now, having forgotten
everything** — the only realistic reader.

---

## Deploy

There is no deploy command. **A push to `main` is the deploy** (ADR-001).

```bash
npm run docs:refresh     # regenerate living docs first
npm test                 # typecheck + vitest + pytest + playwright
git push                 # this is the deploy
```

**Expect ~10 minutes.** That's 722 MB of committed WebP images, not a broken build
(RISK-004). Don't retrigger because it feels slow.

Pre-commit hooks are active if you've run `npm run setup:hooks`. Bypass once with
`git commit --no-verify`.

> ⚠️ **E2E does not run on pre-commit.** UI text renames break Playwright specs and only
> surface on Tier 2 CI. Run `npm run test:e2e` locally before pushing anything visual.

## Everyday commands

| Task | Command |
|---|---|
| Dev server (with CMS) | `npm run dev` → `localhost:4321` |
| Refresh generated docs | `npm run docs:refresh` |
| Check docs are current | `npm run docs:check` |
| Rebuild the inbox | `node scripts/sync-inbox.mjs` |
| Full test suite | `npm test` |

## Rotate a key

**Never paste a key into chat.** Export it in the terminal.

| Key | Where it lives | Rotate at |
|---|---|---|
| `TINA_TOKEN`, `TINA_CLIENT_ID`, `TINA_SEARCH_TOKEN` | `.env` + Vercel dashboard | app.tina.io |
| `TINA_PUBLIC_GOOGLE_PLACES_API_KEY` | `.env` + Vercel | GCP console |
| Admin GitHub PAT | Nowhere persistent — pasted per session | github.com → Developer settings |
| `PUBLIC_GA4_ID`, `PUBLIC_ADSENSE_*` | `.env` + Vercel | Not secrets — they ship in the HTML by design |

After rotating: update **both** `.env` and the Vercel dashboard, then
`npm run docs:refresh` so `system-status.md` reflects reality.

> **Trap:** a GCP key with *Application restrictions: Websites* and an **empty** domain
> list silently blocks all server-side calls, and looks identical to "None" in the UI.
> Full write-up in `docs/operator/api-key-trap.md`.
>
> **Trap:** a trailing newline in a `.env` value has caused corruption here before.

## When something breaks

### Venue-tag scraper returns exit code 2

**Meaning:** auth-gated. Google served the anonymous limited view — no Reviews tab, no
chips. It is *not* a bug in the scraper.

```bash
python scripts/venue-tags/bootstrap_profile.py     # re-establish the signed-in profile
python scripts/venue-tags/scrape_google.py --check-auth   # canary (scrapes Franklin BBQ)
```

If `--check-auth` passes but one venue still fails, that venue may be genuinely
unresolvable — see `docs/operator/unresolvable-venues.md`. Known cases: `cravery-arcadia`
(no clean Maps listing), Run Bing and Had (have CIDs, still gate).

### The build fails on `placeId`

Zod validates `placeId` against `/^0x[0-9a-f]+:0x[0-9a-f]+$/`. A malformed value fails the
build **on purpose** (ADR-001). Fix the frontmatter; don't loosen the schema.

### The build fails on YAML

js-yaml is the authoritative parser and is stricter than PyYAML — it rejects duplicate
keys outright. If a Python script wrote the YAML, validate with js-yaml before assuming
it's fine.

### A pipeline "succeeded" but produced nothing

The recurring failure class here. **Always check counts, never trust exit 0.**

```bash
ls public/venue-tags/*.json | wc -l          # published chips
grep -rl '^placeId:' src/content/posts | wc -l   # tagged posts
```

Compare against `venues.yaml` (814 entries). A gap means venues resolved but never
published — currently 48 of them (TD-004).

### Instagram sync

Trigger by creating a GitHub release tagged `ig-*` with the export ZIP attached;
`instagram-sync.yml` fires on that prefix. The local watcher
(`scripts/local/ig_watcher.sh` + launchd) automates the upload when a ZIP lands in
`~/Downloads`.

**After importing, enrich.** Importing is step 1 of 3. Set `location` (venue name) on each
new post or `curate_candidates.py` skips it forever. Full cadence:
`docs/new-post-enrichment-cadence.md`.

### Vercel deploy is stuck or slow

Check whether the change touched `public/images/`. If so, ~10 minutes is normal. If it
didn't and the build is still slow, check the Vercel dashboard before assuming the repo.

## Scheduled jobs

| Workflow | Purpose |
|---|---|
| `instagram-sync.yml` | Fires on `ig-*` release tags |
| `hitlist-sync.yml` | Hit List sync |
| `nightly.yml` | <!-- TODO(james): what does this do? --> |
| `test.yml` | CI test tiers |

## Recovery

- **Content:** it's all in git. `git revert` or check out an earlier commit.
- **Venue chips:** re-runnable from `venues.yaml` via scrape → publish → sync.
- **Photos:** originals are on the external SSD, not only in the repo.
- **There are no database backups to worry about** — there is no database. This is the
  main operational benefit of ADR-001.
