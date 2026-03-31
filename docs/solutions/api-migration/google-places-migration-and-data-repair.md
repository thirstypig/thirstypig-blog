---
title: "Google Places API Migration, TinaCMS Dark Mode, and Instagram Description Fix"
date: 2026-03-30
tags:
  - google-places-api
  - foursquare
  - tinacms
  - cors
  - dark-mode
  - instagram-import
  - data-repair
  - api-migration
components:
  - tina/LocationLookup.tsx
  - tina/config.ts
  - public/admin/custom.css
  - scripts/fix_descriptions.py
  - scripts/instagram/import_instagram.py
problem_type: api-migration
severity: high
status: resolved
---

## Problem

Three interconnected issues discovered during the same session:

### 1. Foursquare API Broken
- Foursquare's new Places API changed response field names (`geocodes.main.latitude` became top-level `latitude`/`longitude`) without deprecation notice
- The LocationLookup component was requesting a field (`geocodes`) that doesn't exist, causing every API call to fail with "Unexpected field"
- 19.5% venue mismatch rate: 302 of 1,548 geocoded venues resolved to wrong places
- TinaCMS admin location lookup was non-functional

### 2. Google Places API Migration (5 sub-problems)
- `@googlemaps/js-api-loader` v2 removed the `Loader` class (breaking change)
- Legacy `AutocompleteService`/`PlacesService` blocked for new customers since March 2025
- Google Places REST endpoints don't support CORS — `fetch()` from browser fails
- API key with HTTP referrer restriction caused `REQUEST_DENIED`
- TinaCMS dropdown rendered behind other elements (overflow clipping)

### 3. Instagram Description Truncation
- Import script had `desc.strip()[:200]` — silently truncating captions to 200 chars
- 376 posts had descriptions cut mid-word
- The truncation was invisible (no warning logged)

## Root Causes

### Foursquare
Foursquare migrated from v3 API to `places-api.foursquare.com` with a restructured response schema. No deprecation notice was provided. The field `geocodes` simply doesn't exist in the new API — coordinates are top-level `latitude`/`longitude`.

### Google Places Migration (5 distinct root causes)
1. **Loader class removed:** `@googlemaps/js-api-loader` v2 is a complete rewrite. The `Loader` export no longer exists. The new API uses `setOptions()` + `importLibrary()`.
2. **Legacy API blocked:** Google blocks `AutocompleteService` and `PlacesService` for Cloud projects created after March 2025. Only `Place.searchByText()` works.
3. **CORS:** Google's Places REST endpoints (`places.googleapis.com`) lack CORS headers. They're for server-to-server calls only. The Maps JS SDK works because it proxies through Google's own domain.
4. **API key restriction:** HTTP referrer restrictions check the `Referer` header. The Maps JS SDK makes requests from `maps.googleapis.com`, not the app's origin. Fix: remove referrer restriction, use API restriction + quota caps instead.
5. **Dropdown z-index:** TinaCMS wraps form fields in containers with `overflow: hidden`. A `position: absolute` dropdown gets clipped. Fix: `position: fixed` with `getBoundingClientRect()`.

### Description Truncation
Line 398 of `import_instagram.py` had `desc.strip()[:200]` — a development-time safety measure that was never removed. The 200-char limit cuts mid-word with no indication.

## Solution

### Google Places LocationLookup

**Load Maps JS SDK via script tag injection** (bypasses broken npm loader):
```typescript
const script = document.createElement("script");
script.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&v=weekly`;
document.head.appendChild(script);
```

**Use the NEW `Place.searchByText()` API** (not legacy AutocompleteService):
```typescript
const { Place } = google.maps.places;
const { places } = await Place.searchByText({
  textQuery: query,
  fields: ["id", "displayName", "formattedAddress", "location", "addressComponents"],
  locationBias: new google.maps.Circle({
    center: { lat: 34.0522, lng: -118.2437 },
    radius: 50000,
  }),
  maxResultCount: 5,
});
```

**Fix dropdown with `position: fixed`** to escape overflow clipping:
```typescript
// Calculate position from input element
const rect = inputRef.current.getBoundingClientRect();
setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });

// Render with fixed positioning
<div style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left, zIndex: 99999 }}>
```

**API key stored in gitignored JSON** at `tina/google-places-config.json`.

### TinaCMS Dark Mode

**CSS inversion trick** via `cmsCallback` (avoids overriding hundreds of TinaCMS internal styles):
```css
html.tina-dark { filter: invert(0.88) hue-rotate(180deg); }
html.tina-dark img, html.tina-dark video { filter: invert(1) hue-rotate(180deg); }
```

Toggle button injected via `cmsCallback` in `tina/config.ts`, persisted to `localStorage`.

### Description Truncation Fix

Removed `[:200]` slice from `import_instagram.py`. Built `scripts/fix_descriptions.py` to retroactively restore 346 truncated descriptions by re-extracting full captions from post bodies.

## Key Lessons Learned

### 1. Google Places Web Service != Maps JavaScript API
The REST endpoint (`places.googleapis.com`) has no CORS headers — it's for servers only. The Maps JS SDK (`<script>` tag) works in the browser because it proxies through Google's domain. **For any browser component, always use the JS SDK, never direct REST calls.**

### 2. New Google Cloud Customers Can't Use Legacy Places Classes
`AutocompleteService` and `PlacesService` are blocked for projects created after March 2025. The new equivalents are `Place.searchByText()` and `Place.fetchFields()`. **Always check if you're on the "new" or "legacy" API before writing code.**

### 3. `@googlemaps/js-api-loader` v2 is a Breaking Change
The `Loader` class was removed entirely. The new API uses `setOptions()` + `importLibrary()`. **But even simpler: skip the npm package and inject a `<script>` tag directly.** It's one line of code and avoids library version churn.

### 4. API Key Restrictions Can Break the SDK
HTTP referrer restrictions fail with the Maps JS SDK because Google's SDK makes requests from `maps.googleapis.com`. **Use API restriction (limit to Places API only) + quota caps instead of referrer restrictions for development keys.**

### 5. TinaCMS Dropdowns Need `position: fixed`
TinaCMS form containers use `overflow: hidden`. Any dropdown/popover in a custom field component must use `position: fixed` with coordinates from `getBoundingClientRect()`. `position: absolute` will always be clipped.

### 6. Silent Data Truncation is Dangerous
The `[:200]` slice on descriptions produced no error, no warning, no log entry. 376 posts were silently damaged for months. **Always log when data is modified or truncated, even if the truncation is intentional.**

## Prevention Strategies

### API Migrations
- Write an abstraction layer (`venueSearch()`) that normalizes responses — swap providers by changing the adapter
- Test the new API in isolation (standalone script) before integrating into components
- Read the provider's migration guide before writing code
- Pin to a specific API version header

### Google Places Key Management
- Two separate keys: browser (API restriction only) and server (IP + API restriction)
- Set billing alerts at $0, $5, $25 in Google Cloud Console
- Set per-key quota caps (100/day browser, 1,000/day server)
- Never use HTTP referrer restrictions with the Maps JS SDK

### Third-Party Library Pinning
- Pin exact versions: `"@googlemaps/js-api-loader": "2.0.2"` not `"^2.0.2"`
- Read changelogs before major version bumps
- For critical dependencies, add a build-time smoke test

### Data Quality
- Validate field lengths at import time — flag suspicious round-number truncation
- Compare imported data against source (sample 10 posts post-import)
- Run periodic data quality audits (description length histogram, mid-word endings)

## Related Documentation

- [Batch Cleanup: CDN Images and Venue Geocoding](../data-issues/batch-cleanup-cdn-images-and-venue-geocoding.md) — Foursquare v3 deprecation, endpoint migration
- [Location Enrichment from Mentions](../data-issues/location-enrichment-from-mentions-and-map-expansion.md) — Foursquare query discipline, venue matching quality
- [Post Enhancements](../feature-implementations/post-enhancements-seo-admin-content-quality.md) — Original LocationLookup component, TinaCMS field patterns

## Verification

- Google Places auto-fill tested in browser: "Pine and Crane" returns both DTLA and Silverlake locations with correct addresses and GPS
- Dark mode toggle works and persists across page loads
- 346 descriptions restored, build passes (2,920 pages)
- All changes committed and merged to main
