---
status: pending
priority: p3
issue_id: "013"
tags:
  - code-review
  - documentation
  - privacy
dependencies:
  - "004"
---

# Privacy page calls localStorage a "cookie" inconsistently

## Problem Statement

`src/pages/privacy.astro:19` claims:

> "no cookies that identify you"

But line 28 says:

> "A theme preference cookie — If you toggle dark mode, your browser stores your choice locally so the site remembers next visit. This is held in `localStorage` on your device."

`localStorage` is technically not a cookie (different storage mechanism, different lifecycle, doesn't auto-attach to HTTP requests). The privacy page conflates the two terms.

This is a small wording cleanup, separate from the main #004 (which is about analytics/ads). Worth fixing for credibility but low impact.

## Findings

- `src/pages/privacy.astro:19` — "no cookies"
- `src/pages/privacy.astro:28` — describes localStorage as "a theme preference cookie"
- Discovered by kieran-typescript-reviewer during /ce:review

## Proposed Solutions

### Option A: Use "site storage" or "browser storage" consistently

> "A theme preference saved in your browser's local storage. This is not a cookie — it's stored on your device and never sent to any server."

- Pros: technically accurate; helpful distinction for readers who care
- Cons: none
- Effort: Trivial
- Risk: None

## Recommended Action

_Bundle with #004's privacy rewrite._

## Technical Details

Affected files: `src/pages/privacy.astro`

## Acceptance Criteria

- [ ] No conflicting use of "cookie" — the term either appears consistently or not at all on the privacy page

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Identified during /ce:review | Technical accuracy on privacy pages matters for the same reason it matters in API docs — readers comparing claims to reality lose trust on small inconsistencies. |

## Resources

- `src/pages/privacy.astro`
