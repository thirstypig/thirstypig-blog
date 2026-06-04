---
status: pending
priority: p3
issue_id: "041"
tags:
  - ads
  - performance
  - code-review
dependencies: ["038"]
---

# AdInArticle <ins> element missing explicit width:100%

## Problem Statement

The `<ins>` element in `AdInArticle.astro` has `style="display:block; text-align:center;"` but no explicit `width`. AdSense's fluid format reads the computed width of the `<ins>` element at fill time to determine ad dimensions. Without an explicit `width: 100%`, the element may briefly measure a shrink-wrapped width of 0 before layout settles (especially on first paint), causing AdSense to either skip the fill or trigger a secondary layout-based fill with a CLS jank.

The sibling `AdSlot.astro` avoids this via `data-full-width-responsive="true"`, which instructs AdSense to use the container width. The fluid in-article format doesn't use that attribute, so explicit `width: 100%` is the equivalent fix.

## Findings

- `AdInArticle.astro` line 23: `style="display:block; text-align:center;"` — no width
- `AdSlot.astro`: uses `data-full-width-responsive="true"` (different format, same intent)
- Identified by: performance-oracle (P2)

## Proposed Solutions

### Option A: Add width:100% to inline style (Recommended)

```astro
<ins
    class="adsbygoogle"
    style="display:block; text-align:center; width:100%;"
    ...
```

- **Pros:** One-word fix; matches Google's own snippet recommendations for fluid format
- **Cons:** None
- **Effort:** Tiny
- **Risk:** Very low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected file:** `src/components/AdInArticle.astro` line 23

## Acceptance Criteria

- [ ] `<ins>` has `width: 100%` in its inline style

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-04 | Identified in PR #116 review | Fluid in-article format reads ins computed width; missing width may cause fill timing issues |

## Resources

- PR #116: feat(ads): consent-gated in-article AdSense unit
- `src/components/AdSlot.astro` — uses data-full-width-responsive instead
