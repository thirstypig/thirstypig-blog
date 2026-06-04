---
status: pending
priority: p1
issue_id: "038"
tags:
  - ads
  - performance
  - cls
  - code-review
dependencies: []
---

# AdInArticle min-height 200px causes CLS for consenting visitors

## Problem Statement

`AdInArticle.astro` reserves `min-height: 200px` for the fluid in-article slot. Google's fluid in-article format renders at 250–280px on desktop. Every visitor who grants marketing consent will see an 80px layout shift when the ad fills the slot. The sibling `AdSlot.astro` already uses 280px — this is a one-line inconsistency that directly hurts Core Web Vitals.

## Findings

- `AdSlot.astro`: `.ad-slot { min-height: 280px }`
- `AdInArticle.astro`: `.ad-inarticle { min-height: 200px }` — 80px short of the safe floor
- Fluid in-article format renders at variable heights (often 250–280px on desktop), so the 200px reservation is routinely exceeded
- CLS is paid by every consenting visitor on every post page (2,120+ posts all use `BlogPost.astro`)
- Identified by: performance-oracle agent

## Proposed Solutions

### Option A: Raise to 280px (Recommended)

Change line 38 of `src/components/AdInArticle.astro`:
```css
.ad-inarticle {
    display: block;
    margin: 2rem auto;
    min-height: 280px;  /* was 200px */
}
```

- **Pros:** Matches AdSlot, eliminates CLS for consenting visitors, one-line fix
- **Cons:** Slightly taller blank area for non-consenting visitors
- **Effort:** Small (1 line)
- **Risk:** Very low

### Option B: Use 250px

A compromise — Google's minimum recommendation for in-article units.

- **Pros:** Less blank space on non-consent path
- **Cons:** Still risks ~30px CLS hit; not consistent with AdSlot
- **Effort:** Small
- **Risk:** Low but doesn't fully solve the problem

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected file:** `src/components/AdInArticle.astro` line 38
**Affected component:** AdInArticle (rendered on every post page via BlogPost.astro)

## Acceptance Criteria

- [ ] `.ad-inarticle { min-height: 280px }` (or ≥ 280px)
- [ ] Value matches `AdSlot.astro`'s `.ad-slot` min-height

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-04 | Identified in PR #116 review | Performance oracle flagged as P1; fluid in-article standard fill height is 250–280px |

## Resources

- PR #116: feat(ads): consent-gated in-article AdSense unit
- `src/components/AdSlot.astro` — sibling with 280px baseline
- `docs/solutions/feature-implementations/consent-gated-analytics-adsense.md` — notes CLS reservation as a gotcha
