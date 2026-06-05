---
status: complete
priority: p2
issue_id: "049"
tags:
  - accessibility
  - a11y
  - gallery
  - code-review
dependencies: []
---

# Gallery `alt` Text Numbers Off When No Hero Image Present

## Problem Statement

Gallery images use `alt={`${title} — photo ${i + 2}`}` assuming a hero image is always photo 1. For posts with gallery images but no `heroImage`, the first gallery image is labelled "photo 2" instead of "photo 1". Screen reader users get incorrect photo ordering information.

## Findings

`BlogPost.astro` gallery loop:
```astro
{galleryImages.map((img, i) => {
  ...
  alt={`${title} — photo ${i + 2}`}  // ← assumes hero = photo 1
  ...
})}
```

The hero guard is `{heroImage && heroInfo && (...)}` — posts with no hero skip the hero block entirely. If `galleryImages` has items but `heroImage` is falsy, gallery[0] is labelled "photo 2" (a11y violation for screen readers).

From corpus data: some Wayback-recovered posts have no heroImage but do have an `images[]` array.

## Proposed Solutions

### Option A: Conditional index offset (Recommended)

```astro
alt={`${title} — photo ${heroImage ? i + 2 : i + 1}`}
```

One ternary. Zero change to any other behavior.

- **Effort:** XS
- **Risk:** None

### Option B: Count both hero + gallery together

Pre-compute `photoIndex` before the map:
```astro
{galleryImages.map((img, i) => {
  const photoNum = (heroImage ? 1 : 0) + i + 1;
  return <img alt={`${title} — photo ${photoNum}`} ... />;
})}
```

Same result, more explicit.

## Recommended Action

Option A — one-line fix.

## Technical Details

**Affected file:** `src/layouts/BlogPost.astro` — gallery map, `alt` attribute

## Acceptance Criteria

- [ ] Post with no `heroImage` but with `images[]`: first gallery image alt = "…— photo 1"
- [ ] Post with `heroImage` and `images[]`: first gallery image alt = "…— photo 2" (hero is photo 1)
- [ ] Existing WCAG a11y E2E tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by kieran-typescript-reviewer during code review | `i + 2` assumes hero always present; must be conditional |
