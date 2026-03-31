---
title: "Post Enhancements: Location Cards, @Mention Linking, SEO, Admin, Content Quality"
date: 2026-03-30
tags:
  - location-card
  - mention-linking
  - seo
  - json-ld
  - tinacms
  - layout
  - content-quality
  - analytics
  - adsense
  - fonts
  - security
  - performance
components:
  - src/components/LocationCard.astro
  - src/components/ImageGallery.astro
  - src/components/AdSlot.astro
  - src/components/SEO.astro
  - src/plugins/remark-instagram-mentions.mjs
  - src/layouts/BlogPost.astro
  - src/layouts/BaseLayout.astro
  - src/pages/search.astro
  - src/pages/map.astro
  - tina/config.ts
  - tina/LocationLookup.tsx
  - src/styles/global.css
  - astro.config.mjs
problem_type: feature-implementation
severity: medium
status: complete
prs:
  - number: 9
    title: "Post enhancements: location cards, @mentions, SEO, admin, content fixes"
    branch: feature/post-enhancements-seo-admin
  - number: 10
    title: "Fix XSS in map popup HTML escaping"
    branch: fix/map-popup-xss-escaping
---

## Problem

The blog had rich location data (841 geocoded venues, addresses, city/region) stored in frontmatter but none of it was displayed on post pages. Instagram @mentions (1,191 posts) rendered as plain text with no links. 441 posts had generic "Instagram Post -- [Date]" titles with zero SEO value. Grammar errors were scattered across posts. The TinaCMS admin was missing fields for address, coordinates, and images. There was no Restaurant structured data for Google rich results, no visitor analytics, no ad monetization, and render-blocking Google Fonts on every page. The layout buried post text below tall hero images.

### Symptoms

- Posts with known venue data showed no location name, address, or map link
- @handles like `@franklinbbq` appeared as inert plain text instead of clickable Instagram links
- Google indexed hundreds of posts titled "Instagram Post -- March 21, 2026" with identical generic meta descriptions
- Grammar errors ("It's had been a minute", "I'm hope next time") visible on live site
- Admin editors could not update address or coordinates without editing markdown files
- No Restaurant rich result eligibility for 841 geocoded venues
- Hero images (tall portrait photos) pushed all body text below the fold
- Google Fonts CDN caused render-blocking requests on every page load
- No visibility into visitor traffic
- Map and search page popup/result HTML was vulnerable to XSS from unescaped CMS values

## Root Cause

The blog was rebuilt from Wayback Machine archives and Instagram data exports, producing a flat markdown collection with several architectural gaps:

1. **No location display** -- venue names, addresses, coordinates existed in frontmatter but no component consumed them
2. **No content enrichment pipeline** -- Instagram imports produced generic titles, empty bodies, missing meta descriptions, and uncorrected grammar
3. **No venue discovery UX** -- 841 GPS-geocoded venues had no way to be browsed from individual posts
4. **No SEO structured data** -- no JSON-LD for restaurants, despite having all the data
5. **Render-blocking fonts and no ad infrastructure**
6. **XSS vulnerabilities** -- user-generated content injected into HTML via innerHTML without escaping

## Solution

### Astro Components Built

- **LocationCard.astro** -- Renders venue name, city/region, street address with links to internal /map page (with lat/lng anchor) and Google Maps directions. Gracefully returns nothing when fields are missing.
- **ImageGallery.astro** -- Deduplicates images, excludes hero, renders responsive CSS grid of lazy-loaded square thumbnails (280x280) with hover zoom.
- **AdSlot.astro** -- Two-format Google AdSense component (horizontal banner, in-article fluid). Only renders if `PUBLIC_ADSENSE_PUB_ID` env var is set. Includes inline `push()` script per slot.
- **SEO.astro** -- Full meta tag suite (canonical URL, OpenGraph, Twitter Card, article:published_time). Conditional Restaurant JSON-LD when venue data exists. Article JSON-LD for all posts.

### Layout Changes (Option C)

- **BlogPost.astro** -- LocationCard above hero, AdSlot in two positions, ImageGallery after content. Hero image constrained to 16:9 at max 400px height with `object-fit: cover`.
- **BaseLayout.astro** -- Self-hosted fonts via @fontsource, Vercel Analytics, conditional AdSense script, inline theme init to prevent FOUC.

### Remark Plugin: @Mention Auto-Linking

- **remark-instagram-mentions.mjs** -- AST-level transform converting `@handle` patterns to Instagram links. Uses `unist-util-visit` to walk text nodes, splits them into text + link nodes via `parent.children.splice()`. Loads `mention-overrides.json` at module level for skip rules and URL overrides. Only allows `https://` override URLs (security).

### TinaCMS Admin Enhancements

- **tina/config.ts** -- Added fields: address, coordinates (lat/lng object), images array, originalUrl, archiveUrl. Enabled search with indexer and stopword filtering.
- **tina/LocationLookup.tsx** -- Custom React field component with debounced Foursquare Places API search. On result selection, auto-fills location, address, city, region, and coordinates. API key loaded from gitignored `tina/fsq-config.json`. Typed with `TinaFieldProps` and `FoursquarePlace` interfaces. Includes `useEffect` cleanup for debounce timer.

### Content Fix Scripts

All scripts operate on `src/content/posts/*.md`, support `--dry-run`.

| Script | Impact | What It Does |
|--------|--------|-------------|
| `fix_titles.py` | 121 titles fixed | Replaces "Instagram Post -- [Date]" with venue+city from frontmatter. Fixes truncated titles and double spaces. |
| `reformat_titles_seo.py` | 492 titles reformatted | Appends city to titles for SEO ("Omelet Ramen -- Koraku" -> "Omelet Ramen -- Koraku, Little Tokyo"). Conservative: only uses location field if it already appears in title. |
| `fix_grammar.py` | 688 fixes across 684 posts | Fixes lowercase "i" as pronoun, double spaces, tense errors ("it's had been"), missing space after periods. |
| `generate_captions.py` | 87 captions generated | Creates one-line captions for image-only posts from frontmatter: "[Location] in [City]." |
| `generate_descriptions.py` | 12 descriptions generated | Fills missing `description` frontmatter for SEO from body text or title+location+city. |

### Security Fixes

1. **XSS escaping in search.astro and map.astro** -- `esc()` helper creates a DOM text node and reads back innerHTML, neutralizing HTML/script injection in titles, IDs, image URLs, and category names before innerHTML insertion.
2. **URL validation in remark plugin** -- Override URLs only accepted if they start with `https://`. Prevents `javascript:` or `data:` URL injection.
3. **API key handling** -- Foursquare key in gitignored `tina/fsq-config.json`. AdSense pub ID from env var. `.claude/` directory gitignored (contained API key in settings allowlists).
4. **Deleted dead API proxy** -- Removed orphaned `src/pages/api/foursquare-search.json.ts` that exposed an unauthenticated Foursquare proxy endpoint.

### Performance Fixes

1. **Font self-hosting via @fontsource** -- Eliminates render-blocking requests to fonts.googleapis.com. Six font files served from same origin.
2. **Hero image CLS prevention** -- `aspect-ratio: 16/9` on container with `max-height: 400px` reserves space before image loads.
3. **Gallery image sizing** -- `width="280" height="280"` + `decoding="async"` + `loading="lazy"` on thumbnails.
4. **AdSense CLS mitigation** -- `min-height: 90px` (horizontal) / `250px` (article) on ad containers.
5. **Duplicate CSS removed** -- `.sr-only` utility removed (Tailwind already provides it).

## Key Code Patterns

- **Remark AST plugin**: Walk text nodes with `unist-util-visit`, split into text+link nodes via `parent.children.splice()`, return adjusted index
- **Astro graceful degradation**: Every component checks data presence before rendering (`if (!hasLocation) return;`)
- **TinaCMS custom field**: React component using `form.change()` to write to sibling fields when Foursquare result selected
- **JSON-LD with spread operators**: Conditional schema fields via `...(address && { address: {...} })`
- **Module-level file read in remark plugin**: `readFileSync` at import time (not per-invocation) for 2,120 posts

## Prevention Strategies

### Foursquare Mismatch Prevention
- Run a name similarity check (Levenshtein/token overlap) between queried venue name and Foursquare result before accepting
- Always run venue lookups in `--dry-run` mode first and review the diff
- Maintain a known-good override list of venue slug to canonical Foursquare ID mappings

### Content Quality Maintenance
- Pre-commit validation that checks required frontmatter fields, image URL reachability, and location field format
- Schema enforcement via Zod in `content.config.ts` (already in place) rejects malformed entries at build time

### @Mention Override Map
- Build-time warning when new @mentions appear in posts that are not in the override map
- When adding new Instagram posts, check for new @mentions before merging

### SEO Monitoring
- Set up Google Search Console and submit sitemap
- Run Google Rich Results Test on sample posts periodically
- Monitor Core Web Vitals via Vercel Analytics

## Related Documentation

- [Batch Cleanup: CDN Images and Venue Geocoding](../data-issues/batch-cleanup-cdn-images-and-venue-geocoding.md) -- Dead wp.com image cleanup + Foursquare geocoding migration
- [Location Enrichment from Mentions and Map Expansion](../data-issues/location-enrichment-from-mentions-and-map-expansion.md) -- @mention extraction, messy field cleanup, cityCoords expansion

## Verification

All changes verified via:
- `npm run build` -- 2,920 pages built successfully
- Two rounds of multi-agent code review (security, performance, architecture, TypeScript, simplicity)
- Browser testing via Playwright: homepage, post detail, map (1,384 pins), search (51 ramen results), TinaCMS admin (all fields visible including Foursquare auto-fill)
