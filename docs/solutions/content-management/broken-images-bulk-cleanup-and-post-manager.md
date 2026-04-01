---
title: "Fix broken images: mark 518 imageless posts as draft and strip 879 dead image URLs"
date: 2026-03-31
category: content-management
tags:
  - broken-images
  - data-cleanup
  - tinacms
  - admin-tooling
  - python-scripts
  - astro-api
components:
  - scripts/mark_imageless_drafts.py
  - scripts/strip_dead_images.py
  - src/pages/posts-admin.json.ts
  - tina/PostManager.tsx
  - tina/config.ts
symptoms:
  - Posts with no images or dead WordPress/Blogspot image URLs visible on public site
  - Broken-image posts appearing on the map page with no visual content
  - No admin tooling to filter or find affected posts in TinaCMS
root_cause: "Legacy WordPress/Blogspot migration left ~518 posts with missing heroImage and ~879 dead external image URLs embedded in markdown content"
severity: moderate
status: complete
---

# Broken Images: Bulk Cleanup and Post Manager

## Problem

The Thirsty Pig food blog (2,120+ posts) was migrated from three legacy platforms (thirstypig.com, thethirstypig.com, blog.thethirstypig.com) plus Google Blogger/Blogspot. After migration to Astro/TinaCMS:

1. **Dead WordPress URLs** -- Hundreds of posts contained `![alt](http://thethirstypig.com/wp-content/uploads/...)` image references pointing at servers that no longer exist.
2. **Dead Blogspot URLs** -- Posts from Blogger referenced `bp.blogspot.com` CDN images that return 404.
3. **Imageless posts on the public site** -- Posts with zero valid images were still published, showing broken layouts on the homepage, category pages, and the venue map.
4. **No admin visibility** -- TinaCMS's default list view had no way to filter by image status or draft status across 2,120 posts.

Wayback Machine was checked for archived copies of the dead images -- none were found. The images are unrecoverable.

## Root Cause

The WordPress-to-Astro migration preserved the markdown content including inline image URLs, but did not download the actual image files to local storage. When the old WordPress hosting expired, all `wp-content/uploads/` URLs became dead links. Similarly, Google Blogger's image CDN (`bp.blogspot.com`) stopped serving images for old deleted blogs.

## Solution

Three-pronged approach: bulk content cleanup, visibility control, and admin tooling.

### Step 1: Strip Dead Image URLs from Content

**Script:** `scripts/strip_dead_images.py`

Regex-based content cleaner targeting six dead domain patterns:

```python
DEAD_DOMAINS = [
    "thethirstypig.com/wp-content",
    "thirstypig.com/wp-content",
    "www.thethirstypig.com/wp-content",
    "www.thirstypig.com/wp-content",
    "blog.thethirstypig.com/wp-content",
    "bp.blogspot.com",
]
```

Strips five content patterns from the markdown body:
- Markdown images: `![alt](dead-url)`
- Empty-alt Blogger links: `[](dead-url)`
- Angle-bracket autolinks: `<http://dead-url>`
- Bare inline URLs
- HTML `<img>` tags

Also cleans dead URLs from the frontmatter `description:` field. Supports `--dry-run`.

**Result: 879 dead image references removed from 111 posts.**

### Step 2: Mark Imageless Posts as Draft

**Script:** `scripts/mark_imageless_drafts.py`

Scans all posts and sets `draft: true` when a post has zero valid image references or all referenced images are broken. Checks four image sources per post: `heroImage`, `images` array, inline `![](...)`, and `<img>` tags. For each reference, validates local paths against disk (`public/` directory) and treats known-dead external domains as broken.

Uses string replacement (not YAML roundtrip) to avoid reformatting frontmatter:

```python
if "draft: false" in content:
    content = content.replace("draft: false", "draft: true", 1)
```

**Result: 518 posts marked as draft (460 with zero images + 58 with only dead external images).**

### Step 3: Post Manager Admin Screen

**API:** `src/pages/posts-admin.json.ts` -- Astro endpoint returning all posts including drafts with per-post metadata (title, date, categories, location, city, coordinates, draft status, image status).

**UI:** `tina/PostManager.tsx` -- TinaCMS screen plugin with:
- Text search (title, location, city)
- Dropdown filters: draft/live, image status, category, city
- Sortable columns with pagination (50 per page)
- Color-coded badges for image status and draft/live
- Direct edit links to TinaCMS editor
- Draft rows at 70% opacity for visual distinction

## Results

| Metric | Count |
|---|---|
| Dead image references stripped | 879 |
| Posts marked as draft | 518 |
| Total posts in system | 2,120+ |
| Posts remaining live | ~1,600 |
| Build pages reduced | ~2,046 (from ~2,120) |

## Key Design Decisions

1. **`draft: true` instead of a new field.** The `draft` boolean was already wired into every public query (homepage, categories, RSS, sitemap, map). Zero rendering layer changes needed.

2. **String replacement instead of YAML roundtrip.** PyYAML's `safe_dump` reorders keys, strips comments, and changes formatting. With 2,120 posts of varying legacy formatting, this would produce massive unreadable diffs. String replacement changes exactly one line.

3. **Static domain list instead of HTTP probing.** Checking 2,000+ URLs would be slow, flaky, and non-deterministic. The dead domains are known dead. A static list is instant, deterministic, and works offline.

4. **Two scripts, not one.** Strip dead URLs first, then evaluate image status. If draft-marking ran first, posts with only dead references would appear to "have images" and wouldn't be caught.

5. **Build-time JSON endpoint, not TinaCMS GraphQL.** Uses Astro's `getCollection` for direct file access without GraphQL pagination limits. Tradeoff: data reflects last build, not real-time edits. Acceptable for content audit tooling.

## Prevention Strategies

### Import Pipeline Validation
- Download images locally at import time -- never store external URLs as canonical image source
- Fail the pipeline if no image is available; create as `draft: true` with a log message
- Validate image dimensions and format to catch broken downloads

### Build-Time Checks
- No published post without a `heroImage` -- warn or fail the build
- No external image URLs in `heroImage` for published posts
- Log warnings for inline images on external domains

### Periodic Scanning
- Monthly scan of all published posts for broken image references
- Maintain an allowlist of known-good image domains
- Re-run `scripts/mark_imageless_drafts.py --dry-run` after bulk content changes

### Asset Ownership Policy
- Never rely on domains you don't control for serving images
- For any future migration: download all media locally first, rewrite URLs, then migrate content

## Related

### PRs
- [#23](https://github.com/thirstypig/thirstypig-blog/pull/23) -- Add Post Manager admin screen and hide imageless posts
- [#24](https://github.com/thirstypig/thirstypig-blog/pull/24) -- Mark 58 more posts as draft (dead external images)
- [#25](https://github.com/thirstypig/thirstypig-blog/pull/25) -- Strip 879 dead image URLs and mark 58 more posts as draft

### Related Solution Docs
- `docs/solutions/data-issues/batch-cleanup-cdn-images-and-venue-geocoding.md` -- Predecessor image cleanup work
- `docs/solutions/feature-implementations/stats-dashboard-and-batch-enrichment.md` -- Similar admin dashboard pattern
- `docs/solutions/feature-implementations/post-enhancements-seo-admin-content-quality.md` -- Admin content quality tooling

### Scripts
- `scripts/mark_imageless_drafts.py` -- Rerunnable; skips already-drafted posts
- `scripts/strip_dead_images.py` -- Rerunnable; idempotent (no-ops on clean content)
