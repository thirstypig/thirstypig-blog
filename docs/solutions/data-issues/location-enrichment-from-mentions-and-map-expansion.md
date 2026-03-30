---
title: "Fix Instagram venue data quality and expand map coverage"
description: "Resolved multiple data quality issues preventing Instagram-imported posts from displaying correctly on the venue map: messy location fields, missing Texas/Louisiana/Asia pins, and unused @mention venue identifiers."
category: data-issues
tags:
  - instagram
  - foursquare
  - map
  - geocoding
  - venue-extraction
  - data-cleanup
  - mentions
modules:
  - scripts/cleanup_locations.py
  - scripts/fix_venues_from_mentions.py
  - scripts/lookup_addresses.py
  - src/pages/map.json.ts
  - src/pages/map.astro
symptoms:
  - "Texas and Louisiana restaurant posts showed 0 pins on the map"
  - "Instagram posts had full caption text in the location field instead of venue names"
  - "Asia venue pins were present in data but cityCoords lookup table was incomplete"
  - "@mentions in post bodies (e.g., @franklinbbq) were not used for venue identification"
  - "Foursquare returned wrong matches when queried with food descriptions instead of venue names"
root_cause: "Instagram caption parser dumped raw captions into location/city fields; cityCoords map only had 46 cities; @mentions in post bodies were ignored as venue identifiers"
severity: high
date_solved: 2026-03-30
related:
  - docs/solutions/data-issues/batch-cleanup-cdn-images-and-venue-geocoding.md
---

# Fix Instagram Venue Data Quality and Expand Map Coverage

## Problem

The interactive restaurant map at `/map` was missing large geographic regions and showing incorrect venue data:

1. **Texas**: 0 pins despite 16+ posts from a 2017 Austin BBQ trip (Franklin BBQ, Snow's BBQ, etc.)
2. **Louisiana**: Only 2 pins despite 8+ posts from a New Orleans trip (Cafe Du Monde, Mother's Restaurant, Middendorf's)
3. **451 messy posts**: Location fields contained full captions like `"Weekend brunch at Morning Delight Cafe in San Gabriel had a couple of the eg..."` instead of just `"Morning Delight Cafe"`
4. **City fields corrupted**: Values like `"creamed corn..."` or `"LA Jimmy's"` instead of actual city names
5. **Incomplete map coverage**: `cityCoords` lookup only had 46 cities, silently dropping venues in Austin, New Orleans, Medellin, Osaka, etc.

## Root Cause Analysis

### 1. Caption parser over-extracted
The `extract_ig_venues.py` script used regex patterns like `"X at Y"` and `"X from Y"` to extract venue names. But captions like `"Diamond Jim Cut at Lawry's The Prime Rib the Yorkshire pudding creamed corn..."` would match wrong — splitting on "at" captured too much text, and the remainder went into the `city` field.

### 2. No @mention extraction
Instagram posts frequently tag venues with @handles (e.g., `@franklinbbq`, `@snowsbbq`, `@cafedumondeofficial`). These handles are unambiguous venue identifiers sitting right in the post body, but no script was extracting them.

### 3. Texas/Louisiana posts had no city data at all
The caption parser couldn't extract "Austin" from titles like `"almost 3 hour wait"` or `"Tasty pork ribs - must order"`. With no `city` or `region` field, these posts were invisible to the map.

### 4. cityCoords was US-coastal-centric
The lookup table only had 46 entries — mostly LA neighborhoods and a handful of international cities. Any venue in a city not in this table would silently disappear from the map.

## Solution

### Step 1: Clean up messy location/city fields

Created `scripts/cleanup_locations.py` that:
- Identifies posts where `location` is too long (>50 chars), contains `...`, `!`, or looks like a caption
- Identifies posts where `city` is not a recognized city name
- Re-extracts venue names from titles using `"at X"` and `"from X"` patterns
- Re-extracts cities from text and hashtags using a comprehensive city map
- Clears values that can't be resolved (missing data is better than wrong data)

```bash
# Preview changes
python scripts/cleanup_locations.py --dry-run

# Apply
python scripts/cleanup_locations.py
```

**Result**: 451 messy posts fixed — 95 locations re-extracted, 148 cleared, 151 cities fixed, 105 cleared.

### Step 2: Extract venues from @mentions

Created `scripts/fix_venues_from_mentions.py` with a `HANDLE_MAP` dictionary mapping Instagram handles to venue metadata:

```python
HANDLE_MAP = {
    'franklinbbq': ('Franklin BBQ', 'Austin', 'Texas'),
    'snowsbbq': ("Snow's BBQ", 'Austin', 'Texas'),
    'cafedumondeofficial': ('Cafe Du Monde', 'New Orleans', 'Louisiana'),
    'mothersrestaurant': ("Mother's Restaurant", 'New Orleans', 'Louisiana'),
    'howlinrays': ("Howlin' Ray's", 'Chinatown', 'Los Angeles'),
    'thebroadmuseum': ('The Broad', 'Downtown LA', 'Los Angeles'),
    'momofukunoodlebar': ('Momofuku Noodle Bar', 'New York', 'New York'),
    # ... 80+ mappings for TX, LA, LA, NYC, SF, Asia venues
}
```

The script scans post bodies for `@mentions`, filters out person handles (maintained in `PERSON_HANDLES` set), and updates frontmatter when the location field is messy or missing.

```bash
python scripts/fix_venues_from_mentions.py --dry-run
python scripts/fix_venues_from_mentions.py
```

**Result**: 65 venue names set, 38 cities set across 75 posts.

### Step 3: Manual fixes for trip posts

Some posts needed manual city/region assignment because they had no extractable venue data:

- **Texas trip (May-Jul 2017)**: 10 posts set to `city: Austin` / `region: Texas` (or Lockhart for Kreuz Market)
- **New Orleans trip (Jul 2017)**: 6 posts set to `city: New Orleans` / `region: Louisiana`
- **Specific venues**: Middendorf's geocoded manually (Foursquare needed `near=Akers, LA` instead of `near=New Orleans`)

### Step 4: Expand cityCoords in map.json.ts

Expanded from **46 to 104 cities**. Key additions:

```typescript
// Texas
'Austin': [30.2672, -97.7431],
'Lockhart': [29.8849, -97.6700],
'San Antonio': [29.4241, -98.4936],
// Louisiana
'New Orleans': [29.9511, -90.0715],
// More LA neighborhoods
'Los Feliz': [34.1064, -118.2838],
'Malibu': [34.0259, -118.7798],
'Arts District': [34.0395, -118.2330],
// SGV, South Bay, OC expanded
'San Marino': [34.1215, -118.1064],
'Sierra Madre': [34.1617, -118.0528],
'Anaheim': [33.8366, -117.9143],
// US cities
'Chicago': [41.8781, -87.6298],
'New Orleans': [29.9511, -90.0715],
'Seattle': [47.6062, -122.3321],
// International
'Osaka': [34.6937, 135.5023],
'Dalian': [38.9140, 121.6147],
'Medellin': [6.2442, -75.5812],
'Koh Samui': [9.5120, 100.0136],
```

### Step 5: Foursquare geocoding

Ran `lookup_addresses.py` in two batches to geocode newly tagged venues:

```bash
export FOURSQUARE_API_KEY=your_key
python scripts/lookup_addresses.py --limit 160  # First batch (cleanup_locations)
python scripts/lookup_addresses.py --limit 999  # Second batch (fix_venues_from_mentions)
```

**Important**: Foursquare returns its best match even for bad queries. After each batch, manually reviewed and reverted false positives (e.g., "Shaanxi Garden" → "San Gabriel Senior Garden", "Side Chick" → "Chicken Now").

### Step 6: Zoom-responsive map markers

Added dynamic marker sizing to `map.astro` so pins are visible at world zoom:

```javascript
function getRadius(zoom) {
    if (zoom <= 3) return 4;
    if (zoom <= 5) return 5;
    if (zoom <= 8) return 6;
    return 7;
}

map.on('zoomend', () => {
    const r = getRadius(map.getZoom());
    markerGroup.eachLayer(m => m.setRadius(r));
});
```

## Results

| Metric | Before | After |
|--------|--------|-------|
| Total map pins | 1,344 | 1,384 |
| Exact GPS coordinates | 798 | 841 |
| Texas pins | 0 | 28 |
| Louisiana pins | 2 | 12 |
| Cities in map lookup | 46 | 104 |
| Posts with messy location fields | 451 | 0 |
| Posts with venue from @mentions | 0 | 65 |

## Prevention Strategies

### Pipeline order for new Instagram imports

```
1. INGEST: Parse Instagram JSON, store raw fields
2. VALIDATE LOCATION: Reject location values > 80 chars, containing hashtags/emoji/sentences
3. EXTRACT @MENTIONS: Parse caption for @handles, check against HANDLE_MAP
4. VALIDATE CITY: Check against cityCoords allowlist, flag unknown cities
5. GEOCODE: Query Foursquare only for clean venue names (not food descriptions)
6. REVIEW: Generate report of flagged posts, new cities, low-confidence matches
```

### Data quality checks to run periodically

1. **Orphan cities**: Compare all `city` values in posts against `cityCoords` keys — report any missing
2. **Long locations**: Flag any `location` field > 50 characters
3. **Food-word cities**: Flag `city` values containing food terms ("burger", "ramen", etc.)
4. **GPS sanity**: Verify coordinates fall within expected bounding box for stated city
5. **Venue deduplication**: Group posts by normalized venue name, flag spelling variations

### Foursquare query hygiene

- Never send food descriptions as venue queries — pre-filter with `is_good_venue_name()`
- After results come back, compare returned venue name against query (reject low similarity)
- For obscure venues, try alternate `near` values (Middendorf's needed `Akers, LA` not `New Orleans`)

## Key Files

| File | Purpose |
|------|---------|
| `scripts/cleanup_locations.py` | Fix messy location/city frontmatter fields |
| `scripts/fix_venues_from_mentions.py` | Extract venue names from @mentions in post bodies |
| `scripts/lookup_addresses.py` | Foursquare API geocoding |
| `src/pages/map.json.ts` | Map data endpoint with cityCoords lookup |
| `src/pages/map.astro` | Map rendering with Leaflet.js |

## Related

- [Batch Cleanup CDN Images and Venue Geocoding](batch-cleanup-cdn-images-and-venue-geocoding.md) — Prior solution covering the initial Foursquare geocoding of 655 venues and dead image cleanup
