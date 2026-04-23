# CLAUDE.md — thirstypig-blog

## Current status

<!-- now-tldr -->
My food blog from 2007–2017, rebuilt from Wayback Machine archives and back online at thirstypig.com. Sits in maintenance mode now — 2,120 posts and 1,400+ mapped restaurants are live, with new posts wired in automatically from Instagram. Working slowly through the hit list of places to try; no urgency, since the content pipeline runs itself.
<!-- /now-tldr -->

## Quick orientation for Claude Code

- **Stack:** Astro + Tailwind v4 + Tina CMS, deployed on Vercel
- **Content:** archive-only blog — 923 Wayback-recovered posts (2007–2017) + 1,649 Instagram posts (2011–present), all static
- **Scripts:** Python scrapers in `scripts/` (Wayback downloader, Instagram importer, Foursquare geocoder)
- **Live site:** https://thirstypig.com

See `README.md` for the full data-source breakdown and tech stack.
