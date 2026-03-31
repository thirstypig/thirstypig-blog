# Google Places API Migration Plan

**Date:** 2026-03-30
**Status:** Ready to implement

## Overview

Migrate venue lookups from Foursquare to Google Places API (New). Two integration points:
1. **TinaCMS admin** — typeahead location field (browser, React component)
2. **Batch geocoding** — Python script in GitHub Action pipeline (server)

## Why Migrate

- Foursquare had **19.5% venue mismatch rate** on our data (302 of 1,548 geocoded venues)
- Foursquare's new API field names changed without warning (`geocodes` → `latitude`/`longitude`)
- Google Places generally has higher accuracy for US restaurant data
- Google's free tier (5,000 Pro requests/month) is sufficient

## Critical CORS Finding

**Google Places API web service endpoints do NOT support CORS.** Direct `fetch()` calls from the browser will fail. This is the biggest difference from Foursquare (which allows CORS).

**Solution for TinaCMS:** Use the **Google Maps JavaScript SDK** with `@googlemaps/js-api-loader`. The SDK handles CORS internally. Use `AutocompleteService` for typeahead + `PlacesService.getDetails()` for full venue data.

**Solution for batch script:** Direct HTTP POST to `places.googleapis.com/v1/places:searchText`. No CORS issue server-side.

## Setup Steps (for James)

### 1. Google Cloud Console Setup
- [ ] Go to [console.cloud.google.com](https://console.cloud.google.com)
- [ ] Create project (or use existing)
- [ ] Enable **"Places API (New)"** in API Library
- [ ] Create **two API keys** in Credentials:

| Key | Restriction | Used By |
|-----|------------|---------|
| **Browser key** | HTTP referrer: `http://localhost:4321/*` | TinaCMS admin |
| **Server key** | API restriction: Places API (New) only | GitHub Action, Python scripts |

### 2. Billing Protection (REQUIRED)
- [ ] Set **budget alert**: Billing → Budgets → $10/month, alerts at 50/90/100%
- [ ] Set **quota caps**: APIs & Services → Places API → Quotas:
  - Browser key: 100 requests/day
  - Server key: 1,000 requests/day
- [ ] Budget alerts are notifications only — **quota caps actually prevent charges**

### 3. Store Keys
- [ ] Browser key → `tina/google-places-config.json` (gitignored):
  ```json
  { "apiKey": "AIza..." }
  ```
- [ ] Server key → GitHub Secret: `GOOGLE_PLACES_API_KEY`
- [ ] Server key → `.env` for local testing: `GOOGLE_PLACES_API_KEY=AIza...`

## Pricing (Your Use Case: $0/month)

| Endpoint | Free Monthly | Your Usage | Cost |
|----------|-------------|------------|------|
| Autocomplete (admin typeahead) | 10,000 | ~50 lookups | $0 |
| Place Details (after selection) | 5,000 Pro | ~50 | $0 |
| Text Search (batch geocoding) | 5,000 Pro | ~50/month | $0 |

With session tokens, Autocomplete keystrokes are **free** when followed by a Place Details call.

## Implementation: TinaCMS LocationLookup (Browser)

### Architecture Change
- **Before**: Direct `fetch()` to Foursquare → CORS allowed
- **After**: Google Maps JS SDK (`@googlemaps/js-api-loader`) → handles CORS internally

### Key Code Pattern
```typescript
import { Loader } from "@googlemaps/js-api-loader";

// Load Google Maps SDK once
const loader = new Loader({ apiKey: GOOGLE_API_KEY, libraries: ["places"] });
await loader.load();

// Autocomplete with session token (keystrokes are free)
const sessionToken = new google.maps.places.AutocompleteSessionToken();
autocompleteService.getPlacePredictions({
  input: query,
  sessionToken,
  locationBias: new google.maps.Circle({ center: LA_CENTER, radius: 50000 }),
  types: ["restaurant", "food", "bar", "cafe"],
}, callback);

// Place Details (uses same session token → autocomplete was free)
placesService.getDetails({
  placeId: selectedResult.placeId,
  fields: ["name", "formatted_address", "geometry", "business_status", "address_components"],
  sessionToken,
}, callback);
```

### Response Mapping
| Need | Foursquare Field | Google Field |
|------|-----------------|-------------|
| Venue name | `results[].name` | `displayName.text` or `place.name` |
| Address | `location.formatted_address` | `formattedAddress` or `place.formatted_address` |
| Latitude | `latitude` (top-level) | `location.latitude` or `geometry.location.lat()` |
| Longitude | `longitude` (top-level) | `location.longitude` or `geometry.location.lng()` |
| City | `location.locality` | `addressComponents` → type `locality` |
| Region | `location.region` | `addressComponents` → type `administrative_area_level_1` |

### npm Dependency
```bash
npm install @googlemaps/js-api-loader
```

## Implementation: Batch Geocoding (Server)

### Architecture Change
- **Before**: GET to `places-api.foursquare.com` with Bearer token
- **After**: POST to `places.googleapis.com/v1/places:searchText` with JSON body

### Key Code Pattern (Python)
```python
import json, urllib.request

url = "https://places.googleapis.com/v1/places:searchText"
headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": os.environ["GOOGLE_PLACES_API_KEY"],
    "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.businessStatus,places.addressComponents",
}
body = json.dumps({
    "textQuery": f"{venue_name} {city}",
    "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 50000}},
    "pageSize": 1,
}).encode()

req = urllib.request.Request(url, data=body, headers=headers, method="POST")
```

### Field Mask Controls Cost
- **Pro tier** (our target): `displayName`, `formattedAddress`, `location`, `businessStatus`, `addressComponents`
- **Enterprise tier** (avoid): `rating`, `priceLevel`, `reviews`, `currentOpeningHours`
- Adding ANY Enterprise field bumps the ENTIRE request to Enterprise pricing

## Files to Modify

| File | Change | Effort |
|------|--------|--------|
| `tina/LocationLookup.tsx` | Rewrite to use Google Maps JS SDK | 2 hours |
| `tina/google-places-config.json` | New file (browser API key) | 5 min |
| `scripts/lookup_addresses.py` | Switch from Foursquare to Google | 1 hour |
| `scripts/instagram/sync_pipeline.py` | Update env var name | 5 min |
| `.github/workflows/instagram-sync.yml` | Change secret name | 5 min |
| `.gitignore` | Add `tina/google-places-config.json` | 1 min |
| `package.json` | Add `@googlemaps/js-api-loader` | 1 min |
| `.env` | Add `GOOGLE_PLACES_API_KEY` | 1 min |

**Total: ~3.5 hours**

## Files to Remove

| File | Reason |
|------|--------|
| `tina/fsq-config.json` | Replaced by Google config |

## Security Checklist

- [ ] Two separate API keys (browser + server)
- [ ] Browser key restricted to `localhost:4321` referrer
- [ ] Server key restricted to Places API (New) only
- [ ] Quota caps set (100/day browser, 1,000/day server)
- [ ] Budget alert at $10/month
- [ ] `tina/google-places-config.json` in `.gitignore`
- [ ] `GOOGLE_PLACES_API_KEY` in GitHub Secrets
- [ ] `::add-mask::` in GitHub Action workflow

## Implementation Order

1. **Get API keys from James** (browser + server)
2. Store keys (config JSON + .env + GitHub Secret)
3. `npm install @googlemaps/js-api-loader`
4. Rewrite `LocationLookup.tsx` for Google Maps JS SDK
5. Rewrite `lookup_addresses.py` for Google Text Search
6. Update pipeline env var references
7. Test admin auto-fill locally
8. Test batch geocoding locally
9. Commit → push → PR → merge
