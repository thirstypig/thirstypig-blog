---
status: complete
priority: p2
issue_id: "059"
tags:
  - performance
  - lcp
  - preload
  - code-review
dependencies: []
---

# Hero Preload Uses `href` Instead of `imagesrcset` for WebP `<source srcset>`

## Problem Statement

The `<link rel="preload" as="image">` tag uses `href` and `type` to reference the hero WebP. The spec says `href` on preload matches against `<img src>` values, not `<source srcset>` values. For a `<source type="image/webp" srcset="...">`, the correct preload attribute is `imagesrcset`. Chrome handles `href` for single-URL srcsets by accident; Firefox behavior is uncertain. Using `imagesrcset` is the spec-correct fix.

## Findings

Current `BaseLayout.astro`:
```astro
<link rel="preload" as="image" href={props.heroPreloadHref} type={props.heroPreloadType} fetchpriority="high" />
```

The `<picture>` in BlogPost:
```astro
<source type="image/webp" srcset={heroInfo.webp} />
<img src={heroImage} loading="eager" ... />
```

Per the Resource Hints spec: `<link rel="preload" as="image" href="X">` is matched by the browser against `<img src="X">` resources. For a `<source srcset="X">`, the correct preload form is `imagesrcset="X"` (with `imagesizes` if responsive, omitted for single-URL sources).

Chrome 108+ was updated to match `href=X type=image/webp` against a `<source type="image/webp" srcset="X">` for single-URL-no-descriptor cases — but this is not the spec behavior. Firefox may double-fetch (preloading the WebP AND loading the JPG independently).

Additionally: when `heroInfo.webp` is null and the JPG path is preloaded, the `<img>` already has `fetchpriority="high"` which the browser's preload scanner picks up natively. The `<link rel="preload">` in `<head>` is then redundant for the JPG case. It's better to only emit the preload for the WebP case (suppressing it entirely for JPG-only posts) and let the scanner handle the JPG.

## Proposed Solutions

### Option A: Switch to `imagesrcset`, drop `type` and JPG fallback (Recommended)

`BaseLayout.astro`:
```astro
{props.heroPreloadHref && (
  <link rel="preload" as="image" imagesrcset={props.heroPreloadHref} fetchpriority="high" />
)}
```

`BlogPost.astro` — only pass the WebP URL (no JPG fallback):
```astro
heroPreloadHref={heroInfo?.webp ?? undefined}
```

Remove `heroPreloadType` from the `BaseLayout` Props interface and all call sites — it's unused in this corrected form.

- **Pros:** Spec-correct; works in Chrome, Firefox, Safari; removes the unused `heroPreloadType` prop; suppresses the redundant preload for JPG-only posts
- **Cons:** Posts with no WebP sibling get no preload (but the scanner handles them via `fetchpriority="high"` on the `<img>`)
- **Effort:** XS (3 file changes, each 1-2 lines)
- **Risk:** Low

### Option B: Keep `href` and accept Chrome-only optimization

- **Pros:** No change needed
- **Cons:** Not spec-correct; Firefox may double-fetch; `heroPreloadType` prop is still noise

## Recommended Action

Option A — spec-correct, cleaner props interface, and the JPG preload is genuinely redundant since `fetchpriority="high"` on the `<img>` is already a preload scanner signal.

## Technical Details

**Affected files:**
- `src/layouts/BaseLayout.astro` — change `href`+`type` → `imagesrcset`, remove `heroPreloadType` from interface
- `src/layouts/BlogPost.astro` — change `heroPreloadHref={heroInfo?.webp ?? heroImage}` to `heroPreloadHref={heroInfo?.webp}`, remove `heroPreloadType` prop

## Acceptance Criteria

- [ ] `<link rel="preload" as="image" imagesrcset="..." fetchpriority="high">` in built HTML for posts with a WebP hero
- [ ] No preload `<link>` emitted for posts without a WebP hero
- [ ] `heroPreloadType` prop removed from BaseLayout's interface and BlogPost's call site
- [ ] DevTools Network waterfall shows hero WebP starting before the parser reaches `<article>`
- [ ] No double-fetch of the hero image in any browser

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by performance-oracle during code review | href on preload matches img src not source srcset; imagesrcset is the spec-correct attribute for preloading picture sources |
