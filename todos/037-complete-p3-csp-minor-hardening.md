---
status: pending
priority: p3
issue_id: "037"
tags:
  - security
  - csp
  - vercel
  - simplification
  - code-review
dependencies: ["033"]
---

# CSP Minor Hardening: Missing Directives + Redundant X-Frame-Options

## Problem Statement

Several small gaps and one simplification opportunity in the admin security headers:

1. **`form-action` missing** — without it, injected HTML forms can POST to arbitrary origins. `default-src` does not cover `form-action` in all browsers.
2. **`X-Content-Type-Options: nosniff` missing** — allows MIME-sniffing of responses in older browsers.
3. **`Referrer-Policy` missing from `/admin/*`** — navigation from admin pages sends full `Referer` header to external destinations.
4. **`X-Frame-Options: DENY` is redundant** — `frame-ancestors 'none'` in CSP supersedes it in all modern browsers. Keeping both requires them to stay in sync when the CSP changes.

None of these block the current threat model (PAT exfiltration via XSS + connect-src), but they're trivial fixes.

## Proposed Solutions

### Option A: Bundle all four into one CSP patch commit (Recommended)

Add to the `/admin/(.*)` header block:
```json
{ "key": "X-Content-Type-Options", "value": "nosniff" },
{ "key": "Referrer-Policy", "value": "strict-origin" }
```

Add to the CSP string:
```
form-action 'self'
```

Remove:
```json
{ "key": "X-Frame-Options", "value": "DENY" }
```
(keep `frame-ancestors 'none'` in CSP — that's the modern equivalent)

**Effort:** Small  
**Risk:** None — removing `X-Frame-Options` is safe since `frame-ancestors` covers all modern browsers

### Option B: Keep `X-Frame-Options` for belt-and-suspenders

Only add the missing directives; leave `X-Frame-Options` for legacy compatibility (IE11, pre-CSP2 browsers).

**Pros:** Maximum legacy coverage  
**Cons:** Two things to keep in sync; IE11 will never hit your admin  
**Effort:** Same  
**Risk:** None

## Recommended Action

Option A. Bundle with the P1/P2 CSP fixes in todos #033/#034/#036.

## Technical Details

- **Affected file:** `vercel.json`
- Final CSP for `/admin/*` should include: `form-action 'self'`
- Final headers for `/admin/*` should include: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin`
- Remove: `X-Frame-Options: DENY` (redundant with `frame-ancestors 'none'` in CSP)

## Acceptance Criteria

- [ ] `form-action 'self'` added to CSP string
- [ ] `X-Content-Type-Options: nosniff` header added to `/admin/*`
- [ ] `Referrer-Policy: strict-origin` header added to `/admin/*`
- [ ] `X-Frame-Options: DENY` removed (or kept with a comment explaining why)
- [ ] No regressions in admin functionality

## Work Log

- 2026-05-15: Identified during code review of commit `589eccb6`. Security sentinel + code simplicity reviewer findings consolidated here.
