---
title: "Batch Cleanup: Dead CDN Images and Venue Geocoding via Foursquare"
date: 2026-03-29
category: data-issues
tags:
  - astro
  - content-migration
  - dead-images
  - foursquare-api
  - venue-lookup
  - instagram-import
  - wordpress-recovery
  - python-scripts
  - frontmatter-enrichment
  - geocoding
severity: high
component:
  - src/content/posts
  - scripts/strip_dead_images.py
  - scripts/extract_venues.py
  - scripts/instagram/extract_ig_venues.py
  - scripts/instagram/backfill_locations.py
  - scripts/lookup_addresses.py
symptoms:
  - 403 errors from dead wp.com Photon CDN image URLs across 397 posts (5,631 refs)
  - Missing venue name, address, city, and GPS coordinates in post frontmatter
  - Foursquare v3 API endpoint deprecated; required migration to places-api.foursquare.com
  - Instagram posts lacking structured location metadata
  - Map page showing only ~1,000 city-level pins instead of precise locations
---

# Batch Cleanup: Dead CDN Images and Venue Geocoding via Foursquare

## Context

The Thirsty Pig is a 2,100+ post food blog rebuilt from Wayback Machine archives (928 posts) and Instagram data export (1,191 posts) into an Astro + Tailwind CSS + Vercel stack. After the initial content recovery, three interconnected data quality problems remained:

1. **5,631 dead image references** in 397 posts pointing to wp.com Photon CDN (permanent 403s)
2. **Missing venue/location metadata** across ~750 Instagram posts
3. **No street addresses or GPS coordinates** for ~670 posts that had venue names but no geocoded data

## Problem 1: Dead wp.com Photon CDN Images

### Symptoms

Browser console on old posts (e.g., `/posts/2007-04-23-tacos-baja-los-angeles/`):

```
GET https://i0.wp.com/thirstypig.com/wp-content/uploads/2016/08/04232007972.jpg?resize=209%2C157 403 (Forbidden)
GET https://i2.wp.com/thirstypig.com/wp-content/uploads/2016/08/IMG_0904.jpg?resize=209%2C156 403 (Forbidden)
```

### Root Cause

WordPress.com's Photon CDN (`i0.wp.com`, `i1.wp.com`, `i2.wp.com`) served dynamically resized images on the fly via query parameters like `?resize=209%2C157`. These were never static files — the CDN generated them per-request. The Wayback Machine never archived them because they required live server-side processing. After the original blog went offline, all Photon URLs became permanently dead.

### Why CSS Hiding Was Insufficient

We initially added a CSS class `.img-broken { display: none; }` with an `onerror` handler in `BlogPost.astro`. This hid broken images visually, but the browser still issued HTTP requests during DOM parsing — 397 posts x ~10 images each = thousands of 403 requests on every page load, cluttering the console and wasting bandwidth.

### Solution

Strip the dead markup entirely from the markdown source files.

**Script:** `scripts/strip_dead_images.py`

The script identifies dead URLs via the regex pattern `i[0-9]\.wp\.com` and handles three markdown image formats:

1. **Whole-line removal** — If the entire line is a dead image reference (`[![alt](dead-url)](link)`, `![alt](dead-url)`, or `<img src="dead-url">`), drop it
2. **Inline extraction** — If a line mixes dead images with other content, strip only the image markup via `re.subn()`
3. **Whitespace cleanup** — Collapse 4+ consecutive blank lines to 2

The frontmatter is preserved by splitting on `---` and only processing `parts[2]` (the body).

**Result:** 5,631 dead image references removed from 397 posts. Zero console errors.

```bash
python3 scripts/strip_dead_images.py
# Files updated: 397
# Dead image references removed: 5,631
```

## Problem 2: Missing Venue/Location Metadata

### Symptoms

- 441 Instagram posts missing venue name
- 754 Instagram posts missing city
- Map page showed only ~1,000 pins using city-level approximations

### Root Cause

Instagram's data export contains no structured location data (Instagram strips GPS from EXIF in exports). Captions vary wildly — some mention venues explicitly ("Brunch at Toast"), others are just food descriptions, and 435 early posts (2011-2016) have no caption at all.

### Solution

Three extraction scripts targeting different data sources:

**1. `scripts/instagram/backfill_locations.py`** — Matches existing Instagram posts back to the original JSON export by date+title similarity, extracts city/region from captions and hashtags. Result: 211 posts updated.

**2. `scripts/instagram/extract_ig_venues.py`** — Parses caption patterns:
- `"X at Y"` / `"X from Y"` → venue name extraction
- `@mentions` → venue handle to name conversion
- City keywords in text → city/region classification
- Hashtag analysis → `#dtlafood` → Downtown LA, `#pasadena` → Pasadena, etc.

Includes 90+ city keyword mappings and 35+ hashtag-to-city mappings. Result: 141 cities identified, 6 venue names extracted.

**3. `scripts/extract_venues.py`** — Parses original blog post bodies for the `####` heading blocks at the bottom (e.g., `#### Philippe The Original 1001 N Alameda St. L.A.`). Result: 20 addresses extracted, 27 cities identified.

**Remaining gap:** 435 captionless photo-only Instagram posts — no text to extract from.

## Problem 3: Batch Address/GPS Lookup via Foursquare

### Symptoms

669 posts had a venue name and city but no street address or GPS coordinates. The map used city-level coordinate lookup with random jitter, placing pins in approximate locations.

### Foursquare API Endpoint Migration

The original Foursquare v3 endpoint was deprecated:

```
# Old endpoint — returns 401 with API key, 410 with Bearer token
api.foursquare.com/v3/places/search

# New endpoint — working
places-api.foursquare.com/places/search
```

Three critical differences:

| | Old API | New API |
|---|---|---|
| **Domain** | `api.foursquare.com` | `places-api.foursquare.com` |
| **Auth** | `Authorization: {key}` | `Authorization: Bearer {key}` |
| **Version header** | Not required | `X-Places-Api-Version: 2025-06-17` (required) |

### Why OSM Nominatim Failed

We tested OpenStreetMap Nominatim first (free, no API key). Hit rate: ~40% with frequent false positives:
- "Cha Cha Cha" in Los Angeles → matched to a river in Argentina
- "James Y" in Chinatown → matched to a park
- "Cole's French Dip" → not found at all

Nominatim is a geocoder optimized for addresses, not a venue/business database.

### Working Solution

**Script:** `scripts/lookup_addresses.py`

```python
url = f'https://places-api.foursquare.com/places/search?{params}'
headers = {
    'Accept': 'application/json',
    'Authorization': f'Bearer {api_key}',
    'X-Places-Api-Version': '2025-06-17',
}
```

Key design decisions:

- **City name normalization** — LA neighborhoods ("Koreatown", "Silver Lake") mapped to "Los Angeles, CA" via `CITY_SEARCH_NAMES` dict
- **Venue name cleaning** — Strips trailing ellipses, em-dashes, parentheticals before querying
- **Candidate filtering** — Skips non-venue titles ("My Top 10 BBQ", "Sixes", person names)
- **Rate limiting** — 300ms between requests, 5s backoff on 429
- **Selective name update** — Only overwrites `location` field if Foursquare returns a food-category result

```bash
export FOURSQUARE_API_KEY=your_key_here
python3 scripts/lookup_addresses.py --limit 671
# Updated: 655 | Not found: 14
```

**Result:** 97.8% hit rate. 655 venues now have precise addresses and GPS coordinates.

### Coverage Before and After

| Metric | Before | After |
|--------|--------|-------|
| With venue name | 750 (35%) | 1,658 (78%) |
| With city | 437 (20%) | 1,413 (66%) |
| With address | 302 (14%) | 950 (44%) |
| With GPS coords | 1 (0%) | 656 (31%) |
| Map pins | ~1,000 (city-level) | ~1,600+ (many precise) |

## Prevention Strategies

### Dead Image References

- **Self-host all images during migration.** Never depend on third-party CDNs for production.
- **Post-processing validation:** After writing markdown, scan for remaining external image URLs and strip them.
- **CI check:** Grep all `.md` files for `i[0-9]\.wp\.com` patterns — expect zero matches.
- **Build-time image validation:** Verify every path in frontmatter `images` array exists in `public/images/posts/`.

### Missing Venue Metadata

- **Integrate extraction into import pipeline.** Run `extract_venue_from_caption` and `extract_city_from_text` during initial Instagram import, not as a separate backfill.
- **Manual override file:** Maintain `scripts/instagram/venue_overrides.json` for posts that no heuristic can parse.
- **Coverage reporting:** After each import batch, output: N total, N with venue, N with city, N with coordinates.
- **Expand city dictionaries as data files** (JSON/YAML) rather than inline Python dicts.

### Foursquare API Stability

- **Pin API version** via `X-Places-Api-Version` header.
- **Add `--test` flag** that queries a known venue (e.g., "In-N-Out Burger" near "Pasadena") before batch runs.
- **Cache results locally.** Write Foursquare responses to a JSON cache so re-runs don't re-query.
- **Monitor for 410/404 responses** — indicates another endpoint migration.

### Geocoding Quality

- **Validate bounding boxes.** A "Pasadena" restaurant with Houston coordinates is a bad match.
- **Compare returned names.** Low string similarity between input and Foursquare name suggests wrong match.
- **Use `near` parameter** instead of concatenating city into the query string.
- **Expand `CITY_SEARCH_NAMES`** for international cities to include country codes.

## Scripts Reference

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `scripts/strip_dead_images.py` | Remove dead wp.com image refs | Markdown files | Cleaned markdown |
| `scripts/extract_venues.py` | Parse venue info from blog post `####` blocks | Markdown files | Updated frontmatter |
| `scripts/instagram/backfill_locations.py` | Match IG posts to export JSON, add city/GPS | IG JSON + markdown | Updated frontmatter |
| `scripts/instagram/extract_ig_venues.py` | Parse venue/city from IG captions + hashtags | Markdown files | Updated frontmatter |
| `scripts/lookup_addresses.py` | Batch geocode via Foursquare Places API | Markdown files | Updated frontmatter with address + coords |

## Related

- PRs: #1 (archive + dark mode), #2 (strip dead images), #3 (IG venue extraction), #4-5 (lookup script), #6 (Foursquare batch)
- `src/pages/map.json.ts` — Map API endpoint, prefers exact coordinates over city-based lookup
- `src/content.config.ts` — Schema with `coordinates: z.object({ lat, lng }).optional()`
