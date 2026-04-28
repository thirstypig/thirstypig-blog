# CLAUDE.md — thirstypig-blog

## Current status

<!-- now-tldr -->
My food blog from 2007–present, rebuilt from Wayback Machine archives + Instagram exports. 1,639 published posts and 1,400+ mapped restaurants live at thirstypig.com. Active redesign push using Claude Design — extending April 2026's "Bold Red Poster" homepage (full-bleed red hero, Archivo type, the original pig logo, region landing pages) across the rest of the site. Content pipeline runs itself: new Instagram posts arrive via a manual-export pipeline (Meta API is walled for personal Pages — confirmed dead end across both FB Graph and IG Graph in April 2026), a local macOS launchd watcher auto-uploads export ZIPs as GitHub releases when they land in ~/Downloads, and a Monday-9am-PT weekly routine reminds me to drop the new ZIP. 10 places on the hit list.
<!-- /now-tldr -->

## Quick orientation for Claude Code

- **Stack:** Astro + Tailwind v4 + Tina CMS, deployed on Vercel
- **Content:** archive-only blog — 923 Wayback-recovered posts (2007–2017) + 1,649 Instagram posts (2011–present), all static
- **Scripts:** Python scrapers in `scripts/` (Wayback downloader, Instagram importer, Foursquare geocoder)
- **Live site:** https://thirstypig.com

See `README.md` for the full data-source breakdown and tech stack.
