---
status: pending
priority: p2
issue_id: "034"
tags:
  - security
  - csp
  - vercel
  - bucketlist
  - code-review
dependencies: ["033"]
---

# BucketListManager Fetch to `jameschang.co` Blocked by CSP in Production

## Problem Statement

`BucketListManager.tsx` reads `https://jameschang.co/bucketlist.json` on every page load of the Bucket List screen (`fetch(PUBLIC_JSON, { cache: "reload" })`). This cross-origin fetch is not covered by `connect-src` in the new CSP. The browser silently blocks it — the manager loads empty with no items and no error message to the user.

This is a functionality regression caused by the CSP addition. The CORS header on `places-hitlist.json` allowing `jameschang.co` is unrelated (that's the other direction).

## Findings

- `tina/BucketListManager.tsx` line ~300: `fetch(PUBLIC_JSON)` where `PUBLIC_JSON = "https://jameschang.co/bucketlist.json"`
- `connect-src` in admin CSP: no `jameschang.co` origin
- Effect: BucketListManager shows empty list in production; no visible error
- This is a silent regression — the bucket list "works" locally (CSP not enforced in dev) but fails in production

## Proposed Solutions

### Option A: Add `https://jameschang.co` to `connect-src` (Recommended)

Update the CSP `connect-src` directive to include `https://jameschang.co`.

**Pros:** Minimal change, restores production functionality  
**Cons:** None — this is an intentional cross-origin read  
**Effort:** Trivial  
**Risk:** None

### Option B: Proxy via a Vercel rewrite

Add a Vercel rewrite that proxies `/api/bucketlist` to `https://jameschang.co/bucketlist.json`, making it a same-origin request.

**Pros:** Keeps `connect-src` narrower  
**Cons:** Adds infrastructure complexity for a personal tool; overkill  
**Effort:** Medium  
**Risk:** Low

## Recommended Action

Option A. Combine this fix with todo #033 (scoping `*.googleapis.com`) in a single `vercel.json` CSP patch commit.

## Technical Details

- **Affected file:** `vercel.json`, CSP `connect-src` directive
- **Also affected:** `tina/BucketListManager.tsx` line ~300 (no code change needed, just CSP update)
- This fix should be bundled with #033 — both are CSP `connect-src` changes

## Acceptance Criteria

- [ ] `https://jameschang.co` added to `connect-src`
- [ ] BucketListManager loads bucket list entries in production admin
- [ ] No CSP violations in browser console when visiting Bucket List screen

## Work Log

- 2026-05-15: Identified during code review of commit `589eccb6`. Architecture strategist confirmed BucketListManager fetch path.
