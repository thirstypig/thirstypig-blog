# CLAUDE.md — thirstypig-blog

## Current status

<!-- now-tldr -->
My food blog from 2007–present, rebuilt from Wayback Machine archives + Instagram exports. 1,639 published posts and 1,400+ mapped restaurants live at thirstypig.com. **Just shipped (2026-04-27/28): venue-tags MVP** — a headed Playwright pipeline scrapes Google Maps' "Refine reviews" topic chips, publishes per-venue JSON at `/venue-tags/{place_id}.json`, and renders the chips as pills on individual post pages via a new `<VenueChips>` component (5 venues seeded, 4 PRs merged: #82 scraper + index, #83 build hotfix, #84 chips on posts, #85 Yelp resumption playbook). Yelp source paused — IP block; playbook in `scripts/venue-tags/YELP.md`. Active redesign push using Claude Design also continues — extending April 2026's "Bold Red Poster" homepage across the rest of the site. Content pipeline runs itself: new Instagram posts arrive via manual-export + local launchd watcher + Monday-9am-PT weekly reminder (Meta API walled for personal Pages, confirmed dead end). 10 places on the hit list.
<!-- /now-tldr -->

## Quick orientation for Claude Code

- **Stack:** Astro + Tailwind v4 + Tina CMS, deployed on Vercel
- **Content:** archive-only blog — 923 Wayback-recovered posts (2007–2017) + 1,649 Instagram posts (2011–present), all static
- **Scripts:** Python scrapers in `scripts/` (Wayback downloader, Instagram importer, Foursquare geocoder)
- **Live site:** https://thirstypig.com

See `README.md` for the full data-source breakdown and tech stack.
