# AI, API & Data Experimentation Brainstorm

**Date:** 2026-03-30
**Status:** Brainstorm

## What We're Building

A set of experimental features that turn the Thirsty Pig's 2,120 posts and 841 geocoded venues into an intelligent, queryable, visual platform. Three pillars:

### Pillar 1: AI-Powered Restaurant Intelligence
- **AI Recommender** on `/recommend` — "I'm in Koreatown and want spicy noodles" → Claude searches the posts and gives personalized recommendations with links
- **CLI tool** — `pig recommend --city "Koreatown" --cuisine "Korean"` for quick terminal lookups
- **Smart post enrichment** — AI reads each post and auto-tags: cuisine type, price range, vibe (casual/fancy), dish types, open/closed status
- **Auto-generated content** — AI writes city dining guides and "Best of" lists from existing posts; James edits and publishes

### Pillar 2: Public Restaurant API
- **REST API** at `/api/v1/restaurants` serving the 841 geocoded venues
- Endpoints: search by city, cuisine, coordinates (nearby), name
- Filter by: open/closed, cuisine, city, region, rating
- Returns: venue name, address, GPS, city, hero image, post URL
- **Embeddable map widget** — `<iframe>` snippet for a filtered map (e.g., "Jimmy's LA Korean BBQ picks")

### Pillar 3: Personal Dining Dashboard
- **Private dashboard** at `/dashboard` (or password-protected)
- Stats: total restaurants visited, cuisines breakdown, cities visited, posts per year
- Charts: dining frequency over time, cuisine diversity, geographic spread
- Top restaurants revisited (posts at same venue)
- "Dining streak" — longest consecutive days with a post

## Why This Approach

- **Personal experimentation** — James wants to tinker and learn, not optimize for traffic
- **AI + existing data** — 2,120 posts are a rich corpus for Claude to work with
- **API-first** — building a REST API makes all other features easier (dashboard, widget, CLI all consume the same API)
- **Builds on what exists** — the location data, venue geocoding, and content are already there

## Key Decisions

1. **Claude API for recommendations** — not OpenAI. Keeps it in the Anthropic ecosystem, and James is already using Claude Code
2. **API lives on the same Astro site** — Astro API routes (`src/pages/api/`) for simplicity, no separate backend
3. **CLI shares the same data** — reads from `src/content/posts/` locally or hits the API when remote
4. **Dashboard is private** — not public-facing, just for James's personal analytics
5. **Embeddable widget is public** — a read-only filtered map iframe anyone can use
6. **Auto-enrichment runs as a script** — not real-time; batch process that adds structured tags to frontmatter

## Technical Approach (High Level)

### AI Recommender
- Astro SSR page at `/recommend` with a text input
- On submit, sends query + relevant post data to Claude API
- Claude returns recommendations with reasoning
- Posts are pre-indexed into a lightweight search index (JSON) at build time
- The index includes: title, description, location, city, cuisine, tags, coordinates
- Claude receives the top ~20 matching posts as context and recommends from them

### CLI Tool
- Python script: `scripts/pig.py recommend --city "Koreatown" --cuisine "Korean"`
- Reads posts from `src/content/posts/` locally
- Uses Claude API for natural language queries
- Alternatively: simple keyword search without AI for fast lookups

### Public API
- `GET /api/v1/restaurants.json` — all venues
- `GET /api/v1/restaurants.json?city=Koreatown&cuisine=Korean` — filtered
- `GET /api/v1/restaurants.json?lat=34.05&lng=-118.24&radius=2` — nearby
- Built as Astro API routes, generated at build time (static JSON endpoints)
- Or: dynamic API routes if Astro is switched to hybrid/SSR mode

### Embeddable Widget
- `GET /embed/map?city=Koreatown` — returns an HTML page with a Leaflet map
- Designed for `<iframe>` embedding
- Includes "Powered by Thirsty Pig" branding

### Smart Enrichment Script
- `python scripts/enrich_posts.py` — reads each post, sends to Claude for tagging
- Claude extracts: cuisine types, price range ($/$$/$$$), vibe, specific dishes mentioned
- Writes tags back to frontmatter
- Run once as a batch, then incrementally on new posts

### Dining Dashboard
- Astro page at `/dashboard` (could be password-gated or just unlisted)
- Charts via Chart.js or D3.js (lightweight, no framework needed)
- Data sourced from a `/api/v1/stats.json` endpoint generated at build time
- Stats: posts per year, cuisines pie chart, cities bar chart, dining heatmap

## Resolved Questions

1. **SSR vs Static for API** → **Astro hybrid mode**. Most pages stay static, /api/ and /recommend run server-side on Vercel.
2. **Claude API cost** → **No limits**. Pennies per query, James is the main user.
3. **Enrichment scope** → **Deferred to roadmap**. Will do a 100-post test batch when ready.

## Open Questions

1. **API authentication** — Public API with no auth (read-only data), or API key for rate limiting?
2. **Dashboard privacy** — Simple password page, or full auth? Or just an unlisted URL?

## Implementation Priority

### Now (next session)
1. **Public API** (foundation — everything else builds on it)
2. **AI recommender + CLI tool** (the fun, visible features)

### Later (roadmap)
3. **Smart enrichment** (batch Claude tagging of cuisine/price/vibe/dishes)
4. **Dining dashboard** (personal analytics charts)
5. **Embeddable widget** (filtered map iframe)

## Monetization Angle

- AdSense already integrated (just needs `PUBLIC_ADSENSE_PUB_ID`)
- The API could have a free tier + paid tier if it gets traction
- AI recommender could show contextual affiliate links (OpenTable, Resy, Yelp)
- Dashboard is personal, no monetization needed
