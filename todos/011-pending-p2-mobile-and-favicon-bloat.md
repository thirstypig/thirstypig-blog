---
status: pending
priority: p2
issue_id: "011"
tags:
  - code-review
  - performance
  - mobile
dependencies:
  - "006"
---

# Mobile hero ships full-size PNG; favicon.ico inflated 36×

## Problem Statement

Two related but smaller perf wins separate from the main #006 (553KB-on-every-page):

**1. Mobile homepage hero loads the full 553KB PNG just to render a 224×224 element at 50% opacity.** `src/pages/index.astro:51-55` uses the same `redpig-transparent.png` background-image for both desktop bleed and mobile decorative element. On mobile (the bandwidth-constrained path that drives Lighthouse), this is pure waste.

**2. `public/favicon.ico` is now 23,519 bytes** (was 655 bytes pre-session). The new ICO from `scripts/build_favicon.py` packs 16+32+48 px frames. Browsers requesting `/favicon.ico` only need 16/32 — the 48 frame is wasted bytes.

## Findings

- `src/pages/index.astro:51-55` — mobile hero uses same source
- `public/favicon.ico` — 23.5KB (`ls -la public/favicon.ico`)
- `scripts/build_favicon.py:53` — `square.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])`
- Discovered by performance-oracle during /ce:review

## Proposed Solutions

### Option A: Mobile gets a smaller image; favicon drops 48 frame

1. Generate `redpig-transparent-mobile.webp` at ~250px wide via PIL (could be added to the same logo-build script proposed in #006)
2. Update mobile branch in `index.astro` to use the smaller asset (or use `<picture media>` syntax)
3. In `scripts/build_favicon.py`, change `sizes=[(16, 16), (32, 32), (48, 48)]` → `[(16, 16), (32, 32)]`
4. Re-run script and commit

- Pros: ~525KB cut from mobile; ~15KB cut from every favicon request
- Cons: small file proliferation
- Effort: Small (~30 min, mostly tied to #006's logo-build script)
- Risk: Low

### Option B: Skip mobile asset, just trim favicon

- Pros: trivial
- Cons: leaves mobile LCP regression in place
- Effort: Trivial
- Risk: Low

## Recommended Action

_To be filled during triage. Bundle with #006 — the same `build_logos.py` step can emit all variants in one pass._

## Technical Details

Affected files:
- `src/pages/index.astro`
- `scripts/build_favicon.py`
- `public/favicon.ico` (regenerated)
- New: `public/images/redpig-transparent-mobile.webp` (or similar)

## Acceptance Criteria

- [ ] Mobile homepage downloads <50KB total for the hero pig
- [ ] `favicon.ico` <8KB
- [ ] Visual quality unchanged on the homepage at desktop AND mobile widths

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Identified during /ce:review | This is downstream of #006's main fix; same script-extension covers both. |

## Resources

- `scripts/build_favicon.py`
- `src/pages/index.astro`
