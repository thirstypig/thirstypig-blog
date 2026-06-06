---
status: complete
priority: p1
issue_id: "051"
tags:
  - performance
  - lcp
  - seo
  - code-review
dependencies: []
---

# Hero Image Preload Missing — LCP 150–400ms Gap on Every Post

## Problem Statement

`BlogPost.astro` sets `loading="eager" fetchpriority="high"` on the hero `<img>`, but there is no `<link rel="preload">` in `<head>`. The browser only discovers the hero URL after the HTML parser reaches `<article>` body — which is below the caption text, location card, venue tags, and top ad slot. On a cold load this means the hero fetch starts 150–400ms late. `fetchpriority="high"` helps once the tag is parsed, but cannot compensate for the parse delay.

The hero image path (`heroInfo.webp` or `heroImage`) is computed in BlogPost frontmatter at build time and is available to emit as a preload hint in `<head>`.

## Findings

- Performance-oracle agent: "A preload hint in `<head>` would start the fetch before the parser reaches the `<article>` body, saving the parse delay (typically 150–400ms on a cold load)."
- Hero is at layout position 3 (after caption text ~200px). At a 720px container with typical IG portrait images, hero renders at ~540px height.
- WebP siblings exist for 99.9% of images (4,907 of 4,910 cache entries). The preload should target the WebP, not the JPG fallback, so the browser preloads the resource it will actually use.
- Google recommends `<link rel="preload" as="image" fetchpriority="high">` for LCP images: https://web.dev/articles/preload-critical-assets

## Proposed Solutions

### Option A: Pass hero WebP path to BaseLayout as a prop (Recommended)

In `BlogPost.astro`:
```astro
<BaseLayout
  ...
  heroPreload={heroInfo?.webp ?? heroImage ?? undefined}
>
```

In `BaseLayout.astro` (in `<head>`):
```astro
{props.heroPreload && (
  <link
    rel="preload"
    as="image"
    href={props.heroPreload}
    fetchpriority="high"
  />
)}
```

- **Pros:** Correct fix, standard pattern, zero JS cost
- **Cons:** Requires adding a new prop to BaseLayout's interface
- **Effort:** Small (15 min)
- **Risk:** Low

### Option B: Use `<head>` slot in BaseLayout

Add a named `<slot name="head" />` in BaseLayout's `<head>`, let BlogPost emit the preload into it. More flexible for future head-injection needs.

- **Pros:** More extensible
- **Cons:** More invasive change to BaseLayout
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A — the hero image is a BlogPost concern, not a general layout concern. A single prop is cleaner than a named slot.

## Technical Details

**Affected files:**
- `src/layouts/BlogPost.astro` — pass `heroPreload` prop
- `src/layouts/BaseLayout.astro` — add `heroPreload?: string` to interface, emit `<link rel="preload">`

**Important:** Prefer WebP in the preload since `<source type="image/webp">` takes priority in the `<picture>` element. If `heroInfo.webp` is null (rare), fall back to `heroImage`.

## Acceptance Criteria

- [ ] `<link rel="preload" as="image" fetchpriority="high">` appears in `<head>` of every post page that has a hero image
- [ ] Preload href matches the WebP sibling when available, otherwise the original src
- [ ] Post pages without a hero image do NOT emit an empty preload tag
- [ ] Lighthouse / DevTools Network panel shows hero image starting to load before `<article>` is parsed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by performance-oracle during code review | `fetchpriority="high"` only helps after the tag is parsed — preload in `<head>` is the real fix |
