---
status: pending
priority: p1
issue_id: "032"
tags:
  - security
  - csp
  - vercel
  - code-review
dependencies: []
---

# Admin Route Gap: `/admin` (no trailing slash) Gets No CSP Headers

## Problem Statement

The Vercel header rule `"source": "/admin/(.*)"` requires at least one character after the trailing slash. Requests to the bare path `/admin` (no trailing slash) or `/admin/` (empty capture) do not match and receive no CSP, no `X-Frame-Options`, and no `X-Robots-Tag`. Since the TinaCMS admin entry point is `public/admin/index.html`, the browser first requests `/admin/` — which is the exact path this pattern misses.

## Findings

- Pattern `/admin/(.*)` needs a non-empty capture group to match
- `/admin` (no slash): no match → no headers
- `/admin/` (empty capture after slash): no match → no headers
- First request the browser makes is `/admin/` — so the CSP is not applied on the initial page load in some browsers/redirect paths
- A curl to `https://thirstypig.com/admin/` may confirm the absence of `Content-Security-Policy` response header

## Proposed Solutions

### Option A: Add explicit `/admin` and `/admin/` entries (Recommended)

Add two additional header source patterns for the bare paths:

```json
{ "source": "/admin", "headers": [ /* same headers */ ] },
{ "source": "/admin/", "headers": [ /* same headers */ ] },
```

**Pros:** Explicit, guaranteed coverage, no regex subtlety  
**Cons:** Three entries to keep in sync  
**Effort:** Small  
**Risk:** None

### Option B: Change pattern to `/admin{,/**}`

Use Vercel's glob syntax to match `/admin`, `/admin/`, and all sub-paths:

```json
{ "source": "/admin{,/**}", ... }
```

**Pros:** One entry  
**Cons:** Vercel glob behavior for this syntax needs verification  
**Effort:** Small  
**Risk:** Low — test in preview deployment before merging

### Option C: Two patterns: `/admin` and `/admin/(.*)`

```json
{ "source": "/admin", "headers": [...] },
{ "source": "/admin/(.*)", "headers": [...] },
```

**Pros:** Clear intent  
**Cons:** Still two entries  
**Effort:** Small  
**Risk:** None

## Recommended Action

Option A or C — be explicit. Verify with `curl -I https://thirstypig.com/admin/ | grep -i content-security-policy` after deploy.

## Technical Details

- **Affected file:** `vercel.json`, `/admin/(.*)` header block
- **Threat model:** If `/admin/` is served without CSP, any injected script runs without connect-src restrictions, allowing PAT exfiltration to arbitrary domains

## Acceptance Criteria

- [ ] `curl -I https://thirstypig.com/admin` returns `Content-Security-Policy` header
- [ ] `curl -I https://thirstypig.com/admin/` returns `Content-Security-Policy` header
- [ ] `curl -I https://thirstypig.com/admin/index.html` still returns header (should already work)

## Work Log

- 2026-05-15: Identified during code review of commit `589eccb6` (CSP + X-Frame-Options addition)
