---
status: pending
priority: p2
issue_id: "002"
tags:
  - google-places
  - vercel
  - env-vars
  - code-review
dependencies: []
---

# Add Google Places API Key as Vercel Environment Variable

## Problem Statement

The Google Places location lookup in the TinaCMS admin only works locally (reads from gitignored `tina/google-places-config.json`). In production, the API key is empty so the location autocomplete doesn't function.

## Findings

`tina/LocationLookup.tsx` uses `import.meta.glob()` to conditionally load the config file. When the file is absent (production), `GOOGLE_API_KEY` falls back to `""`. The component still renders but Places API calls will fail silently.

## Proposed Solutions

### Option A: Add env var to Vercel + update LocationLookup (Recommended)

1. Add `GOOGLE_PLACES_API_KEY` to Vercel environment variables with the key value
2. Update `LocationLookup.tsx` to check env var as fallback:
   ```tsx
   return config?.apiKey || process.env.GOOGLE_PLACES_API_KEY || "";
   ```

- **Pros:** Location lookup works in production admin
- **Cons:** API key baked into client-side JS (but Google Places keys are client-side by design)
- **Effort:** Small (10 minutes)
- **Risk:** Low

### Option B: Keep production admin without location lookup

Location lookup is a convenience feature for the CMS editor. Since this is a personal blog, editing is primarily done locally where the config file exists.

- **Pros:** No change needed
- **Cons:** Can't use location autocomplete when editing via production admin
- **Effort:** None
- **Risk:** None

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:** `tina/LocationLookup.tsx`
**Key value:** Already in local `tina/google-places-config.json` (gitignored)

## Acceptance Criteria

- [ ] Location autocomplete works in production admin at thirstypig.com/admin
- [ ] OR: Documented decision that location lookup is local-only

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-31 | Identified missing API key in production | `import.meta.glob` gracefully handles missing file but key is empty |

## Resources

- [Google Places API (New) docs](https://developers.google.com/maps/documentation/places/web-service)
- [Solution doc: Google Places migration](../docs/solutions/api-migration/google-places-migration-dark-mode-description-fix.md)
