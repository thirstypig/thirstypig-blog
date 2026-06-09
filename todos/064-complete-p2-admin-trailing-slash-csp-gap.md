---
status: pending
priority: p2
issue_id: "064"
tags: [code-review, security, admin]
dependencies: []
---

# /admin/ trailing-slash path gets no CSP header (pre-existing gap)

## Problem Statement
`vercel.json` has CSP headers for `/admin` and `/admin/(.*)` but not `/admin/` (trailing slash). Vercel's `source` matcher is exact — a request to `https://thirstypig.com/admin/` matches neither rule. The PAT-holding admin page therefore loads with no `Content-Security-Policy`, `frame-ancestors`, `connect-src`, or any other security header. This is pre-existing (not introduced by PR #131) but the new image components make it more relevant since CSP-less `img-src` + `connect-src` is a wider attack surface.

## Findings
- `vercel.json` lines 7, 19: sources are `/admin` and `/admin/(.*)` respectively
- `source: "/admin/"` is absent — trailing slash gets no headers at all
- Security agent: `frame-ancestors 'none'` absent on `/admin/` means clickjacking is possible if a user navigates to that path
- Browsers commonly append trailing slashes when users type bare paths; some redirectors normalize to trailing slash

## Proposed Solutions

### Option A: Add explicit `/admin/` entry to headers (Recommended)
**Effort:** Small | **Risk:** None

Add a third headers entry identical to the `/admin` entry:
```json
{
  "source": "/admin/",
  "headers": [ /* same CSP headers as /admin */ ]
}
```

**Pros:** Explicit. Minimal change. Covers the gap exactly.
**Cons:** Duplicates the CSP block a third time (already duplicated twice).

### Option B: Redirect `/admin/` → `/admin` before headers rules
**Effort:** Small | **Risk:** Low

Add a redirect rule:
```json
"redirects": [
  { "source": "/admin/", "destination": "/admin", "permanent": true }
]
```

**Pros:** Canonical URL. No CSP duplication.
**Cons:** An extra redirect round-trip for users who bookmark with trailing slash.

### Option C: Use a glob matcher covering both
Vercel supports `source: "/admin{/}?"` (regex-style optional trailing slash) in some contexts.

**Effort:** Small | **Risk:** Medium — Vercel matcher syntax varies; needs testing.

## Recommended Action
Option A. Explicit and safe. The CSP duplication is acceptable given this is a small config file.

## Technical Details
- **File:** `vercel.json` lines 7–35 (headers section)
- Pre-existing issue, not introduced by this PR

## Acceptance Criteria
- [ ] `curl -I https://thirstypig.com/admin/` returns `Content-Security-Policy` header
- [ ] `frame-ancestors 'none'` present on `/admin/` response

## Work Log
- 2026-06-09: Identified by security-sentinel agent in CE review of PR #131 (pre-existing gap)
