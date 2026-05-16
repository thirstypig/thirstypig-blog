---
status: pending
priority: p2
issue_id: "036"
tags:
  - security
  - csp
  - vercel
  - maps
  - code-review
dependencies: ["033"]
---

# CSP Missing `font-src` — Google Maps UI May Render Broken Fonts/Icons

## Problem Statement

The admin CSP has no explicit `font-src` directive. The Google Maps JavaScript SDK pulls web fonts from `fonts.gstatic.com` for map UI elements and icons. With no `font-src` set, `default-src 'self'` is the fallback, which blocks all external font origins. The result is that Maps-powered UI in HitListManager may render with broken or fallback fonts and missing icons.

This is a UX regression — not a security issue — but it can make the autocomplete widget look broken without any console error that ties it to the CSP.

## Findings

- CSP `font-src`: not set → falls back to `default-src 'self'`
- Google Maps SDK loads fonts from: `https://fonts.gstatic.com`
- Symptom: Maps UI in HitListManager autocomplete renders with missing icons or generic fallback fonts
- The issue may be intermittent (Maps caches font loads across sessions)

## Proposed Solutions

### Option A: Add `font-src 'self' https://fonts.gstatic.com` (Recommended)

Explicitly allow the Google Fonts static CDN used by the Maps SDK.

**Pros:** Restores intended Maps UI appearance, explicit  
**Cons:** Adds one more external domain to trust  
**Effort:** Trivial  
**Risk:** None

### Option B: Scope to only Maps-needed fonts

Maps SDK currently uses Material Icons from `fonts.gstatic.com`. If you want to be precise:
```
font-src 'self' https://fonts.gstatic.com/s/materialsymbolsoutlined/
```
But URL-path scoping in `font-src` is not widely supported across CSP implementations.

**Pros:** Narrower trust  
**Cons:** Brittle, not standard  
**Effort:** Medium with testing  
**Risk:** Could break on Maps SDK update

## Recommended Action

Option A. Bundle with todo #033 and #034 in the same `vercel.json` CSP patch commit.

## Technical Details

- **Affected file:** `vercel.json`, CSP string — add `font-src 'self' https://fonts.gstatic.com`
- **Verification:** Visit `/admin/` → HitList Manager → type in the place search box → check that autocomplete icons render correctly

## Acceptance Criteria

- [ ] `font-src 'self' https://fonts.gstatic.com` added to CSP
- [ ] Maps autocomplete widget renders with correct icons and fonts in admin
- [ ] No `Refused to load the font` errors in browser console

## Work Log

- 2026-05-15: Identified during code review of commit `589eccb6`. Architecture strategist flagged missing `font-src` directive.
