# Instagram Auto-Sync Pipeline — Implementation Plan

**Date:** 2026-03-30
**Deepened:** 2026-03-30
**Status:** Ready to implement

## Enhancement Summary

**Research agents used:** GitHub Actions best practices, Instagram export format, security sentinel, performance oracle, architecture strategist, learnings researcher
**Key improvements from deepening:**

1. **Switched from Git LFS to GitHub Releases** — avoids LFS costs, removes ZIP from git history, provides audit trail
2. **Added ZIP slip protection** — critical security fix for ZIP extraction
3. **Added content sanitization** — prevent YAML/HTML injection from Instagram captions
4. **Added validation gate before commit** — parse all new markdown, verify images exist, abort on error
5. **Added sync log** — JSON audit trail of every pipeline run
6. **Shallow clone** — repo is 11GB; full clone wastes 60s+ per run
7. **Single push instead of two** — eliminates double Vercel deploy
8. **Concurrency group** — prevents race conditions between runs
9. **Applied Foursquare API learnings** — new endpoint, rate limiting, venue name validation from past solutions

## Overview

Automate syncing new Instagram posts to thirstypig.com. User downloads monthly Instagram data export ZIP, uploads it as a GitHub Release, and a GitHub Action handles everything: download, extract, deduplicate, generate markdown, copy images, geocode venues, validate, commit to main, auto-deploy via Vercel.

## Prerequisites

- [ ] `FOURSQUARE_API_KEY` GitHub Secret
- [ ] Python 3.12+ on runner (default on `ubuntu-latest`)
- [ ] `pip install pyyaml` in workflow
- [ ] Extract shared city data into `scripts/shared/city_data.py` (prerequisite — see Architecture section)

### Research Insight: No Git LFS Needed
All agents agreed: Git LFS is wrong for ephemeral ZIPs. Use GitHub Releases instead.
- ZIP never enters git history (no repo bloat)
- Each release is a timestamped audit record
- Free tier: unlimited releases, 2GB per asset
- User workflow: `gh release create import-2026-04 ~/Downloads/export.zip`

### Research Insight: No Auto-Export from Instagram
Instagram has NO recurring/automatic data export feature. Each export must be manually requested (Settings → Your Activity → Download Your Information). Exports can be requested every 4 days, take minutes to 48 hours to process, and download links expire after 4 days.

## Directory Structure

```
scripts/instagram/
  sync_pipeline.py                    # NEW — orchestrator
  import_instagram.py                 # EXISTS — core import engine
  extract_ig_venues.py                # EXISTS — venue/city extraction
  backfill_locations.py               # EXISTS — GPS backfill from IG export
  data/                               # Temp extraction (gitignored)
scripts/
  shared/
    city_data.py                      # NEW — shared city/region maps (extracted from 3 scripts)
  cleanup_locations.py                # EXISTS — messy field cleanup
  fix_venues_from_mentions.py         # EXISTS — @handle → venue names
  lookup_addresses.py                 # EXISTS — Foursquare geocoding
logs/
  sync-log.json                       # NEW — audit trail of pipeline runs
.github/workflows/
  instagram-sync.yml                  # NEW — GitHub Action
```

## Pipeline Steps

### Step 1: Download and Extract ZIP (with security hardening)

- Download ZIP from GitHub Release asset via `gh release download`
- **Safe extraction** — validate every path resolves within target directory (ZIP slip prevention)
- Reject entries with `..` components, absolute paths, or files > 50MB
- Enforce max 10,000 files and 2GB total extracted size
- Validate `posts_*.json` exists (glob — Instagram splits large exports into multiple files)

```python
# ZIP slip protection (CRITICAL — from security review)
def safe_extract(zip_path, target_dir):
    target_dir = os.path.realpath(target_dir)
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for entry in zf.infolist():
            dest = os.path.realpath(os.path.join(target_dir, entry.filename))
            if not dest.startswith(target_dir + os.sep):
                raise ValueError(f"Path traversal detected: {entry.filename}")
            if entry.file_size > 50 * 1024 * 1024:
                raise ValueError(f"File too large: {entry.filename}")
        zf.extractall(target_dir)
```

### Research Insight: Instagram Export Format
From analysis of actual export data:
- Structure: `your_instagram_activity/media/posts_1.json` + `media/posts/YYYYMM/*.jpg`
- **Can have multiple JSON files** (`posts_1.json`, `posts_2.json`) — must glob for `posts_*.json`
- **No dedicated location field** — Instagram does NOT export the venue tag. GPS comes only from photo EXIF
- Carousel posts: multiple items in `media` array; only first item has caption
- 4,666 JPGs + 213 MP4s + 15 SRT files in a typical 1,649-post export (~1.5GB)
- Some URIs may be CDN URLs instead of local paths — handle gracefully

### Step 2: Import Posts (reuse `import_instagram.py`)
- Parse Instagram JSON, deduplicate by date+title similarity
- Generate markdown with frontmatter, copy media to `public/images/posts/`
- Already handles videos → `public/videos/posts/`
- **Content sanitization**: escape HTML tags in captions before inserting into markdown/YAML
- Use `yaml.dump()` with proper quoting for frontmatter (not string interpolation)

### Research Insight: Deduplication is Already Solid
The existing `is_duplicate()` function short-circuits by date first (O(N*D) where D ≈ 1-3 posts per date). At 500 new posts against 2,120 existing, this runs in well under 1 second. No optimization needed.

### Step 3: Extract Venues (reuse `extract_ig_venues.py`)
- Scan new posts for missing location/city
- Extract from "at X", "from X", @handle patterns
- 130+ entries in CITY_MAP and HASHTAG_CITY_MAP

### Research Insight: Venue Extraction Order (from past solutions)
1. **@mention extraction** (highest confidence — `@franklinbbq` → Franklin BBQ)
2. **Caption pattern matching** (`"at X"`, `"from Y"`)
3. **City/hashtag keyword extraction** (`#dtlafood` → Downtown LA)
- Pre-filter venue names before Foursquare: reject > 50 chars, containing food descriptions
- Maintain `venue_overrides.json` for posts no heuristic can parse

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

### Research Insight: Foursquare API Critical Details (from past solutions)
- **Use NEW endpoint**: `places-api.foursquare.com/places/search` (old v3 returns 410)
- **Required headers**: `Authorization: Bearer {key}` + `X-Places-Api-Version: 2025-06-17`
- **Rate limiting**: 300ms between requests, 5s backoff on 429
- **Candidate filtering**: Compare returned venue name vs. query — reject low similarity matches
- **Known false positive pattern**: Foursquare returns "best match" even for bad queries (e.g., Shaanxi Garden → San Gabriel Senior Garden). Pipeline detected 302 mismatches (~19.5% error rate) in past run
- **Cache results locally** to avoid re-querying on pipeline re-runs

### Step 7: Validate Before Commit (NEW — from security + architecture review)
- Parse every newly-created markdown file's YAML frontmatter
- Verify hero images exist on disk
- Check no orphan cities (compare against `cityCoords` allowlist)
- Flag locations > 50 chars, food-word cities, GPS outside expected bounding box
- If validation fails, abort without committing
- Write summary to `logs/sync-log.json`

### Step 8: Commit and Deploy
- Single commit with all new posts, images, and sync log
- Vercel auto-deploys via webhook (independent of GitHub Actions trigger system)
- `GITHUB_TOKEN` push will NOT trigger other Actions (built-in loop prevention) but WILL trigger Vercel deploy

### Step 9: Cleanup
- Remove extracted ZIP contents from `scripts/instagram/data/`
- ZIP was never in the repo (came from GitHub Release) — no cleanup commit needed

## GitHub Action Workflow

```yaml
name: Instagram Sync
on:
  release:
    types: [created]
  workflow_dispatch:
    inputs:
      release_tag:
        description: 'Release tag with ZIP to process'
        required: true

concurrency:
  group: instagram-import
  cancel-in-progress: false  # Don't kill running imports

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1  # Shallow clone — repo is 11GB, no need for history

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - run: pip install pyyaml

      - name: Download ZIP from release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          TAG="${{ github.event.release.tag_name || github.event.inputs.release_tag }}"
          gh release download "$TAG" --pattern "*.zip" --dir /tmp/import/
          echo "ZIP_PATH=$(ls /tmp/import/*.zip | head -1)" >> $GITHUB_ENV

      - name: Run sync pipeline
        env:
          FOURSQUARE_API_KEY: ${{ secrets.FOURSQUARE_API_KEY }}
        run: |
          echo "::add-mask::${{ secrets.FOURSQUARE_API_KEY }}"
          python scripts/instagram/sync_pipeline.py "$ZIP_PATH"

      - name: Commit and push if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add src/content/posts/ public/images/posts/ public/videos/posts/ logs/
          git diff --staged --quiet && echo "No new posts" && exit 0
          git commit -m "Auto-import Instagram posts [skip ci]"
          git pull --rebase origin main
          git push
```

### Research Insights Applied to Workflow
- **`fetch-depth: 1`** — Shallow clone saves 30-60s. Scripts don't need git history.
- **`concurrency` group** — Prevents race conditions if two releases are created quickly.
- **`cancel-in-progress: false`** — Don't kill a running import mid-pipeline.
- **`::add-mask::`** — Masks Foursquare API key in all log output.
- **`[skip ci]`** — Safety net against workflow loops (redundant with GITHUB_TOKEN but defense-in-depth).
- **`git pull --rebase`** — Handles case where main moved while pipeline ran.
- **Single push** — No separate ZIP cleanup commit needed (ZIP was never in repo).
- **GITHUB_TOKEN** — Sufficient for pushing to unprotected branches. No PAT needed. Vercel webhook still fires.

## Deduplication

Already implemented in `import_instagram.py`:
- Same date + same source: 0.6 title similarity threshold
- Same date + different source: 0.8 threshold
- Handles overlapping monthly exports
- Edge case: if user edits a caption between exports, title similarity may drop below threshold creating a rare duplicate (acceptable)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid ZIP / path traversal detected | Fail fast, exit non-zero |
| Missing JSON after extraction | Fail fast with clear error message |
| YAML injection in caption | Sanitized by `yaml.dump()` safe serialization |
| Foursquare rate limit (429) | Wait 5s, retry. Limit 50 calls/run |
| Foursquare returns wrong venue | Name similarity check rejects low-confidence matches |
| Missing media files | Skip silently (already handled) |
| Import step fails | Abort pipeline, no commit (partial state discarded with runner) |
| Venue extraction fails | Continue to geocoding (partial data is fine) |
| Validation step fails | Abort without committing, log failure to sync-log.json |
| Push race condition | `git pull --rebase` resolves; concurrency group prevents parallel runs |

### Research Insight: Failure Recovery
Since all scripts are idempotent and the working tree is discarded on failure (no commit), a re-run after failure picks up where it left off. Scripts skip posts that already have the relevant data. This gives you transactional semantics for free.

## What Needs to Be Built

| Component | Effort | Lines | Notes |
|-----------|--------|-------|-------|
| `scripts/shared/city_data.py` | 1 hour | ~200 | Extract from 3 scripts. **Do first.** |
| `sync_pipeline.py` (orchestrator) | 2 hours | ~200 | Includes ZIP slip protection, validation, sync log |
| `instagram-sync.yml` (Action) | 1 hour | ~60 | GitHub Release trigger, shallow clone, concurrency |
| `logs/sync-log.json` schema | 15 min | ~20 | JSON log entries with timestamps, counts, errors |
| Update existing scripts to import from shared module | 1 hour | ~50 changes | Replace 3 copies of CITY_MAP |

**Total: ~5.5 hours**

## Security Checklist (from security review)

- [ ] ZIP slip protection in extraction (validate all paths)
- [ ] Max file size (50MB/file) and count (10K files) limits
- [ ] Content sanitization (HTML stripping, YAML-safe serialization)
- [ ] `::add-mask::` for API key in logs
- [ ] Foursquare key via `Authorization` header (not URL params)
- [ ] Pin Actions to SHA hashes (`actions/checkout@a5ac7e51...`)
- [ ] Validation gate before commit
- [ ] `[skip ci]` in commit message

## Performance Notes (from performance review)

**Current repo state:** 11GB working tree (1.55GB packed git, 1.9GB images, 428MB videos). 15,016 images stored as regular git objects (not LFS).

**Disk budget on runner:** 14GB available. At 11GB repo + 1GB extracted ZIP, ~2GB headroom. Delete extracted data immediately after import step.

**Projected scalability:** After ~8-10 imports, repo may exceed 14GB runner disk. Long-term solution: migrate images to external storage (S3/Cloudflare R2) or use Git LFS for images (not ZIPs).

**Estimated runtime per import:** 3-10 minutes total (checkout 30-60s, extract 10-30s, scripts 20-60s, geocoding 10-50s, push 60-300s).

## Implementation Order

### Phase 0: Prerequisite (do first)
1. Extract shared city/region data into `scripts/shared/city_data.py`
2. Update `extract_ig_venues.py`, `cleanup_locations.py`, `import_instagram.py` to import from shared module
3. Fix `backfill_locations.py` sys.path hack

### Phase 1: Orchestrator
4. Build `sync_pipeline.py` with:
   - Safe ZIP extraction
   - Content sanitization
   - Sequential script execution via subprocess
   - Validation gate
   - Sync log writing
5. Test locally with real Instagram export ZIP

### Phase 2: GitHub Action
6. Create `.github/workflows/instagram-sync.yml`
7. Add `FOURSQUARE_API_KEY` GitHub Secret
8. Test by creating a GitHub Release with a ZIP: `gh release create import-test export.zip`

### Phase 3: Verify
9. Confirm Vercel auto-deploys on the Action's commit
10. Verify new posts appear on thirstypig.com
11. Review sync log for accuracy

## User Workflow (After Implementation)

```bash
# 1. Request Instagram data export (Settings → Your Activity → Download Your Information)
#    Choose JSON format, select "Posts" only. Processing takes minutes to 48 hours.

# 2. Upload ZIP as a GitHub Release
gh release create import-2026-04 ~/Downloads/instagram-export.zip \
  --title "Instagram Import April 2026" \
  --notes "Monthly Instagram data export"

# 3. GitHub Action runs automatically
#    - Extracts ZIP, imports posts, geocodes venues
#    - Commits to main, Vercel auto-deploys
#    - Check progress: gh run list --workflow=instagram-sync.yml

# 4. Posts appear on thirstypig.com in ~5-10 minutes
```

## Future Extensibility

The orchestrator should accept a `--source` flag to support future import sources:
```bash
python scripts/instagram/sync_pipeline.py --source instagram export.zip
python scripts/tiktok/sync_pipeline.py --source tiktok export.zip
```
The source-agnostic scripts (cleanup_locations, fix_venues, lookup_addresses) already work on any post regardless of source. Only the import step is source-specific.

## Related Documentation

- [Batch Cleanup: CDN Images and Venue Geocoding](../solutions/data-issues/batch-cleanup-cdn-images-and-venue-geocoding.md) — Foursquare API patterns, image handling
- [Location Enrichment from Mentions](../solutions/data-issues/location-enrichment-from-mentions-and-map-expansion.md) — Venue extraction pipeline order, data quality checks
- [Post Enhancements](../solutions/feature-implementations/post-enhancements-seo-admin-content-quality.md) — @mention linking, content quality scripts
