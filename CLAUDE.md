# CLAUDE.md — thirstypig-blog

## Current status

<!-- now-tldr -->
My food blog from 2007–present, rebuilt from Wayback Machine archives + Instagram exports. 1,639 published posts and 1,400+ mapped restaurants live at thirstypig.com. **Venue tags system shipped at scale (PR #96 + #97):** Places API + headed Playwright pipeline scrapes Google Maps' "Refine reviews" topic tags, publishes per-venue JSON at `/venue-tags/{place_id}.json`, and renders them as pills on post pages via the `<VenueTags>` component. **State after PR #97 cleanup: 319 venues published, 431 posts displaying tags** (down from 320 / 434 — 3 wrong tags removed, 1 mis-curated venue purged). 552 single-post candidates remain in the long tail. The cid→FID self-healing scraper resolves international/CJK venues — fix at `docs/solutions/api-migration/google-maps-cid-fid-self-healing-scrape.md`. **PR #97 added two TinaCMS admin screens**: `Docs` (operator how-it-works) and `Cleanup` (auto-detected duplicate venues + suspect posts where title/location frontmatter disagrees, surfacing a real contamination class). Curator filters tightened (`\bservice\b`, `\brepair\b`, `\bauto\b`, plus `\bpark(?!')\b` apostrophe-fix); venues.yaml hardened against silent dupe-key drift via a strict-loader pytest. Three viz pages (`/tags/cloud`, `/tags/map`, `/tags/graph`), tag-graph banner above `/map`, search ranks results by tag mention_count, nav rationalized (Posts / Cities / Map / Cuisine / Hit List / About) with stable `data-testid` hooks. About page uses a circular SVG badge. Style Sheet panel in TinaCMS admin. Yelp source paused (IP block; YELP.md playbook). The Bold Red Poster redesign continues; venue-tags layered on top of it. Content pipeline runs itself: IG posts arrive via manual-export + local launchd watcher + Monday-9am-PT weekly reminder (Meta API walled for personal Pages — dead end). 10 places on the hit list.
<!-- /now-tldr -->

## Quick orientation for Claude Code

- **Stack:** Astro + Tailwind v4 + Tina CMS, deployed on Vercel
- **Content:** archive-only blog — 923 Wayback-recovered posts (2007–2017) + 1,649 Instagram posts (2011–present), all static
- **Scripts:** Python scrapers in `scripts/` (Wayback downloader, Instagram importer, Foursquare geocoder)
- **Live site:** https://thirstypig.com

See `README.md` for the full data-source breakdown and tech stack.
