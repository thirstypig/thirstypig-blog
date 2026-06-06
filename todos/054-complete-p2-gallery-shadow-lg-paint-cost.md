---
status: complete
priority: p2
issue_id: "054"
tags:
  - performance
  - css
  - gallery
  - code-review
dependencies: []
---

# `shadow-lg` on Full-Height Gallery Images Causes Scroll Paint Cost

## Problem Statement

After removing `overflow: hidden + max-height: 600px`, portrait IG gallery images render at ~900px height (1080×1350 at 720px container). Each gallery `<img>` carries `shadow-lg` (Tailwind: `box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.07)`). Box-shadow on large elements forces a repaint when elements enter the viewport during scroll. On a 10-portrait post (50 exist in the corpus), the user scrolls through 9,000px of shadowed images.

The hero image's `shadow-lg` is fine — it's above-fold and rendered once. The gallery images scroll continuously.

## Findings

`src/layouts/BlogPost.astro` gallery map (line ~137):
```astro
class="post-image w-full rounded-none sm:rounded-xl shadow-lg"
```

Same class is on the hero (line ~112) — but the hero is above-fold. The gallery images enter the viewport during scroll, each triggering a paint pass proportional to `720px × 900px = 648,000px²` of shadow area per image.

Performance-oracle agent: "Box-shadow on large elements forces the browser to repaint that element's layer on every frame where the element is in or entering the viewport."

The `rounded-xl` class already provides visual separation between images. The shadow is cosmetic on gallery images and adds measurable paint cost on lower-end hardware (Moto G class Android).

## Proposed Solutions

### Option A: Remove `shadow-lg` from gallery images, keep on hero (Recommended)

Hero class (unchanged):
```astro
class="post-image w-full rounded-none sm:rounded-xl shadow-lg"
```

Gallery class (remove `shadow-lg`):
```astro
class="post-image w-full rounded-none sm:rounded-xl"
```

- **Effort:** XS (1-word removal in the gallery map)
- **Risk:** Low — cosmetic change, `rounded-xl` still separates images

### Option B: Add `contain: layout style paint` to `.post-image-wrap`

Enables compositor layer promotion as a hint. Does not remove the shadow cost but helps the browser batch it.

```css
.post-image-wrap {
  contain: layout style paint;
}
```

- **Effort:** XS
- **Risk:** Low, but less effective than Option A

## Recommended Action

Option A — removing the shadow from gallery images is simpler and eliminates the cost entirely. The visual difference is negligible since `rounded-xl` still provides definition.

## Technical Details

**Affected file:** `src/layouts/BlogPost.astro` — gallery map `img` class attribute (~line 137)

## Acceptance Criteria

- [ ] Hero image still has `shadow-lg`
- [ ] Gallery images have `rounded-xl` but no `shadow-lg`
- [ ] Scroll performance on a 10-portrait post is smooth on Lighthouse mobile simulation
- [ ] Visual difference is acceptable (can verify in browser)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by performance-oracle during code review | shadow-lg on 900px images causes per-frame repaint during scroll; hero is fine since it's above-fold |
