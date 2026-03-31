# Brainstorm: Instagram Auto-Sync Pipeline

**Date:** 2026-03-30
**Status:** Ready for planning

## What We're Building

An automated pipeline that syncs new Instagram posts to thirstypig.com with minimal manual effort. The user downloads their periodic Instagram data export ZIP (sent via email every 30 days), uploads it to the GitHub repo, and a GitHub Action handles everything else: extracting posts, copying media, extracting venue/city metadata, geocoding via Foursquare, and auto-deploying to Vercel.

### User Flow

```
1. Instagram sends data export link to email (every 30 days, auto-scheduled)
2. User downloads the ZIP from the email link
3. User uploads the ZIP to the GitHub repo (via web UI or `gh` CLI)
4. GitHub Action triggers automatically:
   a. Extracts ZIP
   b. Runs import pipeline (deduplication, media copy, frontmatter generation)
   c. Extracts venues from @mentions and captions
   d. Cleans up messy location/city fields
   e. Geocodes new venues via Foursquare API
   f. Commits new posts directly to main
   g. Vercel auto-deploys
   h. Cleans up the ZIP from the repo
5. New posts appear on thirstypig.com within minutes of upload
```

## Why This Approach

### Decision: GitHub Action + ZIP upload (not Meta API)

**Reason:** User prefers not to set up a Meta Developer App. Instagram's built-in recurring data export (Settings > Your Activity) provides the same data without API complexity. The only manual step is downloading the ZIP from email and uploading to GitHub.

**Tradeoffs accepted:**
- Posts appear within 30 days (not real-time) — acceptable for a blog archive
- One manual step remains (download + upload ZIP) — but it's < 2 minutes of effort
- ZIP files with media can be large — solved with Git LFS (1GB free) or JSON-only exports

### Decision: Auto-deploy (no PR review)

**Reason:** User trusts the pipeline to get venue/city extraction right. The existing scripts have been battle-tested on 2,100+ posts. Auto-deploying minimizes friction — the goal is "upload ZIP, walk away."

### Decision: Same-day timing

**Reason:** Instagram exports are monthly batches, not real-time. The GitHub Action runs immediately on ZIP upload, so posts appear within minutes of the upload step. The 30-day batch cycle is the real timing constraint, not the pipeline speed.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Trigger mechanism | ZIP upload to GitHub repo | No Meta API needed, user-initiated |
| Data source | Instagram recurring data export | Built-in feature, full data including media |
| Media handling | Git LFS or JSON-only export | Avoid repo bloat from large ZIPs |
| Pipeline execution | GitHub Action | Runs in CI, not dependent on user's Mac |
| Deployment | Auto-merge to main | Minimal friction, trusted pipeline |
| Venue extraction | Existing scripts (import + extract + cleanup + mentions) | Already tested on 2,100+ posts |
| Geocoding | Foursquare API (key as GitHub Secret) | 97.8% hit rate proven |
| Post frequency | Monthly batch (Instagram export cycle) | Acceptable for blog archive use case |

## Scope

### In Scope
- GitHub Action workflow (`.github/workflows/instagram-sync.yml`)
- Unified pipeline script that runs all 6 steps in sequence
- Git LFS setup for ZIP handling
- Foursquare API key as GitHub Secret
- Auto-cleanup of ZIP after processing
- cityCoords auto-detection for new cities (build-time warning if unknown city found)

### Out of Scope (for now)
- Meta API / Instagram Basic Display API integration
- Real-time posting (webhook-based)
- Image optimization (WebP conversion) in the pipeline
- Tina CMS integration for post editing
- Email parsing to auto-download the ZIP

## Technical Considerations

### GitHub Action Trigger & Environment
- **Trigger**: `push` event filtered to `imports/**` path — detects when ZIP is pushed via `gh` CLI
- Needs Python 3.12+ with PyYAML
- Needs Foursquare API key as `FOURSQUARE_API_KEY` secret
- Needs write permission to commit back to the repo (`contents: write`)
- ZIP extraction may need significant disk space (500MB+ with media)
- Action timeout: default 6 hours should be sufficient
- Geocoding capped at 50 lookups per run to stay within Foursquare free tier (1,000/day)

### Pipeline Consolidation
Current pipeline is 6+ separate scripts run manually in sequence. For the Action, these should be consolidated into a single entry point:

```bash
python scripts/instagram/sync_pipeline.py path/to/export.zip
```

This would call existing scripts in order, handling errors and reporting results.

### Deduplication
The import script already deduplicates by date + title similarity. Re-running on overlapping exports (e.g., exporting every 30 days with overlapping date ranges) is safe — duplicates are skipped.

### Media Handling Options
1. **Git LFS**: Upload full ZIP including media. LFS handles the large file. Action extracts media to `public/images/posts/`. Committed images stay in the repo permanently (they're the blog content).
2. **JSON-only export**: Instagram allows exporting without media. Posts would have frontmatter but no images. Images could be added later or sourced differently.
3. **Separate media upload**: Extract JSON from ZIP locally, upload JSON to repo. Upload media to S3/R2/Cloudflare separately. More complex but cleanest.

**Recommended:** Git LFS for simplicity. The blog images are permanent content that belongs in the repo. LFS handles the upload-time ZIP; the extracted images are normal git files.

## Resolved Questions

| Question | Resolution |
|----------|------------|
| How to trigger Action on ZIP upload? | Use `push` trigger filtered to `imports/**` path. User pushes ZIP via `gh` CLI to `imports/` folder. |
| ZIP upload size limits? | GitHub web UI caps at 25MB but `gh` CLI / `git push` has no practical limit. Git LFS handles the large file tracking. |
| What if Instagram export format changes? | Add schema validation at the start of the pipeline. If JSON structure doesn't match expected shape, fail fast with clear error message. |
| Foursquare rate limits in CI? | Free tier allows 1,000 calls/day. Pipeline should cap geocoding at 50 per run and process remaining on next sync. Most runs will have <30 new posts. |
| Images bloating git history? | Existing repo already has ~2GB of images in git. This is the accepted pattern — blog images are permanent content. Git LFS handles the temporary ZIP only. |

## Open Questions

_None — all key decisions resolved during brainstorm._

## Next Steps

Run `/ce:plan` to create a detailed implementation plan for:
1. GitHub Action workflow file
2. Consolidated pipeline script (`sync_pipeline.py`)
3. Git LFS setup
4. GitHub Secrets configuration
5. Testing with a real export
