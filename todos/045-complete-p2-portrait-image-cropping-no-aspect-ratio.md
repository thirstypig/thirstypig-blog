---
status: complete
priority: p2
issue_id: "045"
tags:
  - css
  - images
  - performance
  - layout
  - code-review
dependencies: []
---

# Portrait Images Cropped Unpredictably — `.post-image-wrap` Missing Aspect Ratio

## Problem Statement

The new `.post-image-wrap` container uses `max-height: 600px; overflow: hidden; height: auto` with no declared `aspect-ratio`. For portrait-format Instagram photos (standard 4:5 or 1:1 ratio), the crop point varies by viewport width — a 1080×1350 image renders ~1600px tall on a 1280px desktop, gets silently cropped to 600px, with `object-fit: cover` centering it. Top and bottom are cut off with no visual indication.

The old `.hero-container` was explicit: `aspect-ratio: 16/9` declared the crop intent clearly.

## Findings

Current CSS in `BlogPost.astro` lines 183-194:
```css
.post-image-wrap {
  max-height: 600px;
  overflow: hidden;
  /* ← no aspect-ratio — crop depends on viewport */
}
.post-image {
  width: 100%;
  height: auto;        /* ← portrait images grow taller than 600px at wide viewports */
  max-height: 600px;   /* ← redundant: parent overflow:hidden clips first */
  object-fit: cover;
}
```

For a 1080×1350 IG portrait (standard 4:5):
- At 390px (iPhone SE): rendered height = 487px — fits within 600px, no crop
- At 1280px (desktop): rendered height = 1600px — clipped to 600px, loses ~63% of image height

The `max-height: 600px` on `.post-image` is completely unreachable because the parent's `overflow: hidden` clips at 600px first.

## Proposed Solutions

### Option A: Remove the container constraint, let images display at natural size (Recommended for gallery)

```css
.post-image-wrap {
  /* remove max-height and overflow:hidden */
}
.post-image {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 0; /* or use sm:rounded-xl on img directly */
}
```

Best for full-size gallery intent. Instagram portrait photos show completely. Food photos deserve to be seen in full.

- **Pros:** True "full size", no surprise crops, simple CSS
- **Cons:** Very tall portrait images (1:1 square IG at 1280px desktop = 1280px tall) — may feel overwhelming
- **Effort:** Small
- **Risk:** Low — purely visual

### Option B: Declare an explicit aspect ratio

```css
.post-image-wrap {
  aspect-ratio: 4 / 3;  /* or 3 / 2, or 1 / 1 */
  overflow: hidden;
}
.post-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

Consistent crop across all images, cinematic feel. Loses some content at edges.

- **Effort:** Small
- **Risk:** Low

### Option C: Keep max-height but remove redundant `.post-image` max-height

If cropping is intentional (consistent look, no extremely tall posts):

```css
.post-image-wrap {
  max-height: 600px;
  overflow: hidden;
}
.post-image {
  width: 100%;
  height: auto;
  object-fit: cover;  /* centers the crop */
  /* remove redundant max-height: 600px here */
}
```

Same visual as current but removes the dead CSS rule.

## Recommended Action

Option A for a personal blog showcasing food — show the full photo. If the result feels too tall on desktop, add a `max-height: 800px` (not `overflow:hidden` — just sizing) and let the image scale naturally. Decide after seeing it in a browser.

## Technical Details

**Affected files:** `src/layouts/BlogPost.astro` lines 183-194

## Acceptance Criteria

- [ ] Decision on cropping intent is documented in a comment in the CSS
- [ ] Portrait 4:5 IG photos display fully (or are cropped to declared ratio) at 1280px desktop
- [ ] No redundant CSS rules remain
- [ ] Hero image and gallery images behave consistently

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by kieran-typescript-reviewer and performance-oracle during code review | The old aspect-ratio: 16/9 was explicit about cropping; new code is ambiguous |
