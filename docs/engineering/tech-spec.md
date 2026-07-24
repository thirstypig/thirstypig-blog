---
id: DOC-007
type: tech-spec
status: active
phase: null
owner: james
tags: [build-deploy, admin, content-pipeline]
links: [ADR-001, DOC-008]
updated: "2026-07-23"
---

# Tech spec

How the site is actually put together. For *why* it's shaped this way, see ADR-001.

**Stack:** Astro 6 · Tailwind CSS v4 · TinaCMS · Vercel · MDX · self-hosted Fontsource
fonts. Content is markdown on disk; there is no database.

---

## Architecture at a glance

```
                        ┌─────────────────────────────────────┐
   OFFLINE (Python)     │  scripts/                            │
   run by hand,         │   venue-tags/  instagram/  scraper/  │
   never at build       │   + 32 loose enrichment scripts      │
                        └──────────────┬──────────────────────┘
                                       │ writes markdown + JSON
                                       ▼
                        ┌─────────────────────────────────────┐
   SOURCE OF TRUTH      │  git repo                            │
                        │   src/content/posts/*.md   (2,127)   │
                        │   public/venue-tags/*.json (766)     │
                        │   public/images/  (722 MB WebP)      │
                        │   scripts/venue-tags/venues.yaml     │
                        └──────────────┬──────────────────────┘
                                       │ git push → Vercel hook
                                       ▼
                        ┌─────────────────────────────────────┐
   BUILD (~10 min)      │  astro build                         │
                        │   validate:hitlist → tinacms build   │
                        │   remark plugins: mentions, images   │
                        │   9 × *.json.ts endpoints evaluated  │
                        └──────────────┬──────────────────────┘
                                       ▼
                        ┌─────────────────────────────────────┐
   SERVED               │  dist/ — static files on Vercel      │
                        └──────────────┬──────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
            readers (thirstypig.com)            /admin (TinaCMS)
                                                        │
                                                        │ PAT in sessionStorage
                                                        ▼
                                              api.github.com  ──┐
                                              (Contents API)    │
                                                                │
                                              commit ───────────┘
                                              └─→ triggers a new build
```

**The loop closes through git.** An admin edit is a commit, and a commit is a rebuild.
There is no runtime write path. See ADR-001 for the consequences.

## Request flow (reader)

There isn't one, in the usual sense. Every reader-facing URL is a file generated at build
time and served from Vercel's CDN. No origin compute, no per-request rendering.

The exceptions are client-side only:
- **Search** — fetches `/search.json` and filters in the browser.
- **Map** — fetches `/map.json`.
- **Consent + ads** — scripts stay `type="text/plain"` until consent flips them on.

## Data path (content)

| Stage | Where | Notes |
|---|---|---|
| Authoring | `src/content/posts/*.md` | YAML frontmatter + markdown body |
| Schema | Astro content collection (Zod) | `placeId` validated `/^0x[0-9a-f]+:0x[0-9a-f]+$/` — malformed values **fail the build** |
| Transform | `src/plugins/remark-*.mjs` | `remark-instagram-mentions` auto-links `@handles`; `remark-image-optimize` |
| Enrichment | `scripts/**` | Offline, manual. Never runs at build. |
| Render | `src/layouts/`, `src/components/` | See DOC-011 |

## Build pipeline

```
npm run build
  └─ validate:hitlist        node scripts/validate_hitlist.mjs   (fails build on bad data)
  └─ tinacms build --skip-cloud-checks
  └─ cp tina/admin-custom.css public/admin/custom.css
  └─ astro build
```

<!-- TODO(james): confirm the Vercel deploy trigger. Assumed to be push-to-main via the -->
<!-- default Git integration, but no workflow file states it explicitly. -->

## Directory map

| Path | Holds |
|---|---|
| `src/pages/` | 31 files — routes + 9 build-time JSON endpoints (DOC-008) |
| `src/components/` | 14 Astro components (DOC-011) |
| `src/layouts/` | 2 — `BlogPost.astro` is the significant one |
| `src/utils/` | 17 files — 8 strict `x.ts` + `x.test.ts` pairs |
| `src/plugins/` | 4 remark plugins |
| `tina/` | Admin screens + `_shared/github-contents.ts` |
| `scripts/` | Python pipelines + 1 `.mjs` validator |

## Known structural notes

- **`scripts/` is only half-modular.** `venue-tags/`, `instagram/`, `scraper/`, `local/`
  are self-contained modules with their own tests. The **32 loose `.py` files at the root
  are not** — they include three overlapping venue-fixers and four title/description
  fixers. Many are one-shot migrations that already ran.
- **`scripts/shared/` holds exactly one module** (`city_data.py`), while `post_utils.py` —
  a de facto shared helper — sits outside it at the root. The shared boundary is nominal.
- **`src/components/` and `src/utils/` are flat.** At 14 and 17 files that is *appropriate*;
  foldering them would add indirection for no gain.

<!-- TODO(james): decide whether the 32 loose scripts are worth consolidating, or whether -->
<!-- they should be marked as historical one-shots and left alone. Leaving them is a -->
<!-- legitimate answer — but it should be a decision, not drift. -->
