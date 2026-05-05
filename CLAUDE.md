# CLAUDE.md — thirstypig-blog

## Current status

<!-- now-tldr -->
My food blog from 2007–present, rebuilt from Wayback Machine archives and Instagram exports — **1,639 posts and 1,400+ mapped restaurants live at thirstypig.com**. Just shipped venue tags at scale: a pipeline pulls topic tags from Google Maps and shows them as little pills on each post page, so a single visit to any post tells you what the place is actually known for (319 venues published, 434 posts now displaying tags). Then tightened the privacy promise — ripped out Google Analytics and AdSense (the privacy page claimed "no analytics" while quietly shipping all three) and rewrote it to actually match what's loaded. Next up: keep extending tags into the long tail of single-venue posts, and continue rolling out the Bold Red Poster redesign across the rest of the site.
<!-- /now-tldr -->

## Quick orientation for Claude Code

- **Stack:** Astro + Tailwind v4 + Tina CMS, deployed on Vercel
- **Content:** archive-only blog — 923 Wayback-recovered posts (2007–2017) + 1,649 Instagram posts (2011–present), all static
- **Scripts:** Python scrapers in `scripts/` (Wayback downloader, Instagram importer, Foursquare geocoder)
- **Live site:** https://thirstypig.com

See `README.md` for the full data-source breakdown and tech stack.
