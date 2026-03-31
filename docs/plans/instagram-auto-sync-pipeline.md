# Instagram Auto-Sync Pipeline — Implementation Plan

**Date:** 2026-03-30
**Status:** Ready to implement

## Overview

Automate syncing new Instagram posts to thirstypig.com. User downloads monthly Instagram data export ZIP, pushes to `imports/` via `git push`, GitHub Action handles everything: extract, deduplicate, generate markdown, copy images, geocode venues, commit to main, auto-deploy via Vercel.

## Prerequisites

- [ ] Git LFS setup (`.gitattributes` tracking `imports/*.zip`)
- [ ] `FOURSQUARE_API_KEY` GitHub Secret
- [ ] Python 3.12+ on runner (default on `ubuntu-latest`)
- [ ] `pip install pyyaml` in workflow

## Directory Structure

```
imports/                              # Git LFS tracked, ZIP landing zone
  .gitkeep
scripts/instagram/
  sync_pipeline.py                    # NEW — orchestrator
  import_instagram.py                 # EXISTS — core import engine
  extract_ig_venues.py                # EXISTS — venue/city extraction
  backfill_locations.py               # EXISTS — GPS backfill from IG export
  data/                               # Temp extraction (gitignored)
scripts/
  cleanup_locations.py                # EXISTS — messy field cleanup
  fix_venues_from_mentions.py         # EXISTS — @handle → venue names
  lookup_addresses.py                 # EXISTS — Foursquare geocoding
.github/workflows/
  instagram-sync.yml                  # NEW — GitHub Action
```

## Pipeline Steps

### Step 1: Extract ZIP
- Extract to `scripts/instagram/data/`
- Validate `posts_1.json` exists (or `posts_*.json` glob)

### Step 2: Import Posts (reuse `import_instagram.py`)
- Parse Instagram JSON, deduplicate by date+title similarity
- Generate markdown with frontmatter, copy media to `public/images/posts/`
- Already handles videos → `public/videos/posts/`

### Step 3: Extract Venues (reuse `extract_ig_venues.py`)
- Scan new posts for missing location/city
- Extract from "at X", "from X", @handle patterns
- 130+ entries in CITY_MAP and HASHTAG_CITY_MAP

### Step 4: Clean Locations (reuse `cleanup_locations.py`)
- Fix fields with raw captions instead of venue names
- Clear unfixable fields

### Step 5: Fix Mentions (reuse `fix_venues_from_mentions.py`)
- Resolve @handles to venue names (100+ curated mappings)
- Set city/region from mapping

### Step 6: Geocode (reuse `lookup_addresses.py`)
- Query Foursquare for posts with location+city but no coordinates
- `--limit 50` per run (free tier: 1,000/day)
- Rate limit handling built in

### Step 7: Cleanup
- Remove extracted ZIP contents from `scripts/instagram/data/`

## GitHub Action Workflow

```yaml
name: Instagram Sync
on:
  push:
    branches: [main]
    paths: ['imports/**']

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true
          fetch-depth: 0
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install pyyaml
      - name: Run sync pipeline
        env:
          FOURSQUARE_API_KEY: ${{ secrets.FOURSQUARE_API_KEY }}
        run: python scripts/instagram/sync_pipeline.py imports/*.zip
      - name: Commit new posts
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/content/posts/ public/images/posts/ public/videos/posts/
          git diff --cached --quiet || git commit -m "Auto-import Instagram posts"
          git push
      - name: Cleanup ZIP
        run: |
          rm -f imports/*.zip
          git add imports/
          git diff --cached --quiet || git commit -m "Remove processed Instagram export"
          git push
```

## Deduplication

Already implemented in `import_instagram.py`:
- Same date + same source: 0.6 title similarity threshold
- Same date + different source: 0.8 threshold
- Handles overlapping monthly exports

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid ZIP / missing JSON | Fail fast, exit non-zero, GitHub reports failure |
| Foursquare rate limit (429) | Wait 5s, retry. Limit 50 calls/run. Ungeoocoded posts picked up next run |
| Missing media files | Skip silently (already handled) |
| Import step fails | Abort pipeline |
| Venue extraction fails | Continue to geocoding (partial data is fine) |
| Geocoding fails | Commit what we have (posts without coordinates are valid) |

## What Needs to Be Built

| Component | Effort | Lines |
|-----------|--------|-------|
| `sync_pipeline.py` (orchestrator) | 2 hours | ~150 |
| `instagram-sync.yml` (Action) | 1 hour | ~80 |
| `.gitattributes` (LFS tracking) | 5 min | 1 |
| `imports/.gitkeep` | 1 min | 0 |

**All 6 existing scripts are fully reusable with no modifications needed.**

## Implementation Order

### Phase 1: Foundation
1. Create `imports/` with `.gitkeep`
2. Create `.gitattributes` with LFS rule
3. `git lfs install` and commit
4. Add `FOURSQUARE_API_KEY` GitHub Secret

### Phase 2: Orchestrator
5. Build `sync_pipeline.py`
6. Test locally with real ZIP

### Phase 3: GitHub Action
7. Create `instagram-sync.yml`
8. Test by pushing ZIP to `imports/`

### Phase 4: Verify
9. Confirm Vercel auto-deploys
10. Verify new posts on thirstypig.com

## User Workflow (After Implementation)

```bash
# 1. Download Instagram data export (Settings → Your Activity → Download Your Information)
# 2. Push ZIP to the repo
cp ~/Downloads/instagram-export.zip imports/
git add imports/instagram-export.zip
git commit -m "Add Instagram export March 2026"
git push
# 3. GitHub Action runs automatically, posts appear on site in ~5 minutes
```
