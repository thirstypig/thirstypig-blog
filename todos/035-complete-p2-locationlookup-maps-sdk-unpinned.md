---
status: pending
priority: p2
issue_id: "035"
tags:
  - security
  - supply-chain
  - tina-cms
  - code-review
dependencies: []
---

# `LocationLookup.tsx` Uses Unpinned `v=weekly` Google Maps SDK

## Problem Statement

`tina/HitListManager.tsx` correctly pins the Google Maps SDK to a specific quarterly version (e.g. `v=3.62`) with an explanatory comment. `tina/LocationLookup.tsx` loads the same SDK with `v=weekly`, which silently rotates to a new bundle every week.

A compromised or malicious Maps SDK update would execute with full access to the `/admin/` page, including the GitHub PAT in `sessionStorage`. Since `script-src` already allows `https://maps.googleapis.com`, any code in a future weekly bundle runs with full page trust — CSP cannot distinguish a legitimate Maps SDK from a backdoored one.

This is a supply-chain risk window that HitListManager explicitly closed but LocationLookup did not.

## Findings

- `tina/HitListManager.tsx`: Maps SDK URL contains `v=3.62` (pinned, correct)
- `tina/LocationLookup.tsx` line ~58: Maps SDK URL contains `v=weekly` (unpinned, risk)
- Both files load the Maps API for Google Places autocomplete
- The admin CSP allows `https://maps.googleapis.com` in `script-src` without hash or SRI — version pinning is the only supply-chain control

## Proposed Solutions

### Option A: Pin LocationLookup to same version as HitListManager (Recommended)

Change `v=weekly` to match whatever `v=X.XX` HitListManager uses. Add the same explanatory comment.

```ts
// Pinned to v=3.62 (quarterly release). Don't use v=weekly — it silently 
// rotates and would execute in admin context with PAT access.
```

**Pros:** Closes the supply-chain window; consistent with existing pattern  
**Cons:** Must manually update pin on quarterly Maps SDK releases  
**Effort:** Trivial (1 line change)  
**Risk:** None

### Option B: Extract shared Maps loader utility

Consolidate both files' SDK loading into a single `tina/utils/maps-loader.ts` with the pinned version defined once.

**Pros:** Single source of truth for the version pin  
**Cons:** Refactor scope beyond a security fix  
**Effort:** Small  
**Risk:** Low

## Recommended Action

Option A now; Option B if you later refactor the admin managers.

## Technical Details

- **Affected file:** `tina/LocationLookup.tsx` line ~58
- **Current value:** `...&v=weekly`
- **Target value:** Same quarterly version string as `HitListManager.tsx`

## Acceptance Criteria

- [ ] `LocationLookup.tsx` Maps SDK URL changed from `v=weekly` to pinned quarterly version
- [ ] Comment added explaining why pinning is necessary in the admin context
- [ ] Google Places autocomplete in LocationLookup still works after pin change

## Work Log

- 2026-05-15: Identified during code review of commit `589eccb6`. Security sentinel flagged the version discrepancy between the two admin manager files.
