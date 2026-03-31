---
title: "Content Stats Dashboard & Batch Post Enrichment"
date: 2026-03-31
category: feature-implementations
tags:
  - tina-cms
  - admin-dashboard
  - content-stats
  - batch-enrichment
  - claude-api
  - screen-plugin
components_affected:
  - src/pages/stats.json.ts
  - tina/StatsDashboard.tsx
  - tina/config.ts
  - scripts/enrich_posts.py
  - scripts/sync_categories.py
status: implemented
---

# Content Stats Dashboard & Batch Post Enrichment

## Overview

Two features built in a single session:

1. **Content Stats Dashboard** — A build-time stats endpoint + React dashboard registered as a TinaCMS Screen Plugin, accessible from the admin sidebar.
2. **Batch Post Enrichment** — A two-phase Python script that retitles posts to "Venue, City" format, clears old categories, and classifies cuisine/dish tags via Claude Haiku API.

## Feature 1: Content Stats Dashboard

### Problem
No way to see blog content stats (posts per year, top cities, cuisine breakdown, data coverage) from the admin panel. Vercel Analytics covers visitor traffic but not content metadata.

### Solution

Three files:

**`src/pages/stats.json.ts`** — Build-time Astro endpoint (same pattern as `map.json.ts` and `search.json.ts`). Queries all posts via `getCollection('posts')` and computes: posts by year, posts by source, top 20 cities, top categories/tags, GPS/image coverage stats, unique venues, closed venues, and 10 recent posts. Output is a static JSON file regenerated on each deploy.

**`tina/StatsDashboard.tsx`** — React component that fetches `/stats.json` and renders the dashboard with CSS-only horizontal bar charts (no chart library). Uses inline styles to avoid conflicts with TinaCMS's Tailwind classes. Exports a `StatsIcon` component for the sidebar. Dark mode handled automatically by the existing `html.tina-dark { filter: invert(0.88) }` CSS rule.

**`tina/config.ts`** — Two lines added: import the component and register it as a TinaCMS Screen Plugin via `cms.plugins.add({ __type: 'screen', name: 'Content Stats', Component, Icon, layout: 'fullscreen' })`.

### Key Decisions
- **CSS bars, no chart library** — Keeps bundle small. Each bar's width is `(count / max) * 100%`.
- **Build-time computation** — Zero runtime cost. Stats update on each Vercel deploy.
- **Screen Plugin API** — TinaCMS's official extension point. Appears in sidebar automatically with routing at `#/screens/content_stats`.
- **Inline styles** — Matches `LocationLookup.tsx` pattern, avoids CSS class conflicts.

### Stats Displayed
- Total posts (2,120), venues (1,261), GPS-geocoded (754), cities (20), closed (39)
- Posts by year timeline (2007-2026) with gradient bar chart
- Source breakdown (Instagram 1,191, thethirstypig.com 511, thirstypig.com 408, blog 10)
- Top 20 cities (Shanghai 298, Los Angeles 147, Taipei 110, ...)
- Data coverage: GPS 36%, City 64%, Hero Image 75%, Gallery 75%
- Top categories (cuisine) with coverage bar (1,468/2,120 = 69%)
- Top tags, recent posts table
- **Needs Attention** section: scrollable table of 652 uncategorized posts with direct TinaCMS edit links

## Feature 2: Batch Post Enrichment

### Problem
2,120 posts with inconsistent titles, virtually no tags (20/2,120), no cuisine data (2/2,120), and leftover pig-rating categories. Needed clean, simple metadata for SEO and map integration.

### Solution

**`scripts/enrich_posts.py`** — Two-phase Python script:

**Phase 1 (Deterministic, no AI):** For posts with `location` AND `city` in frontmatter, sets `title = "Location, City"`, sets `tags = [city-tag]`, clears `categories = []`. Uses `yaml.safe_load` / `yaml.dump(sort_keys=False, allow_unicode=True, width=1000)` for frontmatter I/O. Completed on all 2,120 posts: 1,674 modified, 980 title changes.

**Phase 2 (Claude API):** Sends each post's title + description + body excerpt to Claude Haiku (`claude-haiku-4-5-20251001`, temperature=0, max_tokens=150). Claude returns JSON with cuisine type, 1-2 dish tags, title correction if needed, and city backfill. Completed all 2,120 posts across multiple sessions (~$1.00 total cost). 1,468 posts classified with a cuisine; 652 posts identified as non-restaurant content (travel, sports, meta posts).

### CLI Interface
```
python3 scripts/enrich_posts.py --dry-run --phase1-only --limit 20
python3 scripts/enrich_posts.py --phase2-only --resume --limit 100
```

Note: `--limit` caps the number of **new** posts to process (not total file list). When combined with `--resume`, already-completed posts are skipped first, then the limit applies to remaining posts.

### Key Decisions
- **Two-phase approach** — Phase 1 handles ~60% of posts instantly with no API cost
- **Claude Haiku** — Cheapest model, sufficient for food classification
- **Progress checkpoint** — Saves to `scripts/.enrich_progress.json` every 50 posts for resumability
- **Canonical cuisine values** — 25 fixed options (Japanese, Korean, Mexican, etc.) to prevent tag sprawl

### Category Sync

**`scripts/sync_categories.py`** — Copies `cuisine` field values into `categories` for all posts. Posts with no cuisine get `categories: ["Uncategorized"]`. This makes cuisine values browsable via the existing `/categories/` pages while keeping the `cuisine` field for structured data (JSON-LD).

```
python3 scripts/sync_categories.py --dry-run
python3 scripts/sync_categories.py
```

### Results After Enrichment
| Metric | Before | After |
|--------|--------|-------|
| "Venue, City" titles | 1,030 | 1,435 |
| Posts with tags | 20 | 2,120 |
| Posts with cuisine | 2 | 1,468 |
| Categories (cuisine-based) | ~15 (mixed) | 44 cuisines + Uncategorized |
| Cities backfilled | 1,367 | 1,410 |
| Unique cuisines | 0 | 44 |

### Bug Fixed During Code Review
Line 351 had `progress = load_progress() if args.resume else load_progress()` — both branches identical. Fixed to reset progress when not resuming.

## Related Documentation
- [Post Enhancements, SEO, Admin, Content Quality](post-enhancements-seo-admin-content-quality.md) — Previous session's work on LocationCard, JSON-LD, title/grammar fixes
- [AI, API & Data Experimentation Brainstorm](../../brainstorms/2026-03-30-ai-api-data-experimentation-brainstorm.md) — "Pillar 3: Dining Dashboard" and "Smart Enrichment" concepts implemented here
- [Google Places Migration](../../solutions/api-migration/google-places-migration-dark-mode-description-fix.md) — Related admin customization (dark mode, LocationLookup)

## Production Admin Fix

TinaCMS admin at `/admin/index.html` was returning 404 in production. Three issues:

1. **`tinacms build` failing silently** — The build script used `|| true` which swallowed errors. Fixed by switching to `--skip-cloud-checks` flag which bypasses the Tina Cloud indexing wait.
2. **`LocationLookup.tsx` importing gitignored file** — `import googleConfig from "./google-places-config.json"` fails on Vercel where the file doesn't exist. Fixed with `import.meta.glob()` which returns empty when the file is absent.
3. **Tina Cloud env vars** — `TINA_CLIENT_ID`, `TINA_TOKEN`, and `TINA_SEARCH_TOKEN` must be set in Vercel environment variables for production builds.

Build script changed from:
```
npx tinacms build || true && astro build
```
to:
```
npx tinacms build --skip-cloud-checks && astro build
```

### Bugs Fixed (PR #16)
- **`--limit` flag was broken for resume** — It sliced the total file list before filtering out completed posts, so `--resume --limit 1850` would find all 1850 done and process zero. Fixed to cap **new** posts processed.
- **Frontmatter parser broke on `---` in field values** — `content.index('---', 3)` found `| --- | --- |` (markdown table separators) inside `description` fields before the actual closing delimiter. Fixed to search for `\n---` (must be at start of line).

## Prevention / Future Work
- ~~Remaining 820 posts need Phase 2 enrichment~~ **DONE** — All 2,120 posts enriched
- 652 uncategorized posts need manual category assignment (Travel, Baseball, etc.) via admin dashboard
- Some cuisine values could be consolidated (Cafe→Coffee, Boba→Dessert, Asian→specific cuisine)
- Consider `ThreadPoolExecutor` for 5-10x speedup on future batch runs
- Consider Anthropic Batch API for 50% cost savings on large runs
- Google Search Console set up — sitemap submitted, 2,920 pages discovered
- Tina Cloud credentials: `TINA_CLIENT_ID`, `TINA_TOKEN`, `TINA_SEARCH_TOKEN` in Vercel env vars
- Re-run `sync_categories.py` after manually assigning cuisines to uncategorized posts
