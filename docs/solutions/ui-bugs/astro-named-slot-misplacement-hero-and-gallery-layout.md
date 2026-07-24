---
title: "Astro Named Slot Misplacement: Hero Buried + RelatedPosts Inside Prose"
slug: astro-named-slot-misplacement-hero-and-gallery-layout
date: 2026-06-04
category: ui-bugs
tags:
  - astro
  - layout
  - slots
  - image-gallery
  - blog-post
  - instagram-posts
components:
  - src/pages/posts/[...slug].astro
  - src/layouts/BlogPost.astro
  - src/components/RelatedPosts.astro
  - src/components/ImageGallery.astro
symptoms:
  - Hero image appeared missing or pushed ~1400px below the fold
  - '"You might also enjoy" section appeared between caption text and hero image'
  - Gallery images rendered as small thumbnails requiring a click + new tab
  - After prose migration removed inline images, food photos appeared to have vanished entirely
root_cause: >
  RelatedPosts was passed as an unnamed default slot child in [...slug].astro alongside
  <Content />, causing it to render inside the .prose wrapper in BlogPost.astro — between
  the caption text and the hero image. This inflated the article flow, pushing the hero
  1400px below the fold. The "vanishing images" was a false alarm: images were present and
  fully loaded in the DOM, just visually inaccessible due to layout order.
prs:
  - "#120: fix(layout): hero image first, related posts last; slim top nav"
  - "#121: fix(layout): full-size gallery images, caption-first post order"
related_docs:
  - docs/solutions/feature-implementations/front-end-audit-and-image-pipeline.md
  - docs/solutions/feature-implementations/post-enhancements-seo-admin-content-quality.md
  - docs/solutions/feature-implementations/consent-gated-analytics-adsense.md
---

# Astro Named Slot Misplacement: Hero Buried + RelatedPosts Inside Prose

## Symptoms

- Hero food photo appeared to be missing or far below the fold (~1400px off-screen)
- "You might also enjoy" section rendered between the caption and the hero image
- Gallery images rendered as a thumbnail grid with click-to-new-tab links instead of full-size inline images
- After `migrate_ig_prose.py` stripped inline `![...]()` tags from 1,185 IG post bodies, food photos appeared to have completely vanished

## Root Cause

Astro's default `<slot />` is a "collect everything not assigned to a named slot" bucket. Both `<Content />` and `<RelatedPosts />` were passed as unnamed children of `<BlogPost>`:

```astro
// [...slug].astro — WRONG
<BlogPost {...post.data}>
  <Content />
  <RelatedPosts currentId={post.id} ... />  ← no slot="..." attribute
</BlogPost>
```

`BlogPost.astro` wrapped its default slot in `.prose`:

```astro
<div class="prose max-w-none">
  <slot />  ← both Content AND RelatedPosts render here
</div>
<!-- hero image appears WAY down here, after the inflated prose block -->
```

`RelatedPosts` rendered inside `.prose`, pushing the hero image and gallery hundreds of pixels down. On a typical IG post the prose block was short (2–3 sentences), so the displacement was extreme relative to the visible content.

The images were **not gone** — `heroExists: true`, `galleryImageCount: 4`, `heroImgNaturalSize: {w: 3023, h: 2267}`, `heroImgComplete: true` — just visually buried.

## Investigation

Used Playwright `browser_evaluate` to inspect the DOM at runtime:

```javascript
() => {
  const article = document.querySelector('article');
  return {
    hasNew: !!document.querySelector('.post-image-wrap'),
    hasOld: !!document.querySelector('.hero-container'),
    order: [...article.children].map(el => ({
      cls: el.className?.split(' ')[0],
      imgs: el.querySelectorAll('img').length,
      txt: el.textContent?.trim().slice(0, 50),
    })),
  };
}
```

This confirmed the `gallery-section` and `hero-container` existed in the DOM with loaded images, and showed `RelatedPosts` appearing between `.prose` and the hero at position 5 in the article child list.

Also used `getBoundingClientRect()` to confirm the hero was at `top: 1419px` — below the fold on any normal viewport.

## Fix

### 1. Named slot in `[...slug].astro`

```astro
// BEFORE — RelatedPosts falls into default slot, renders inside .prose
<BlogPost {...post.data}>
  <Content />
  <RelatedPosts currentId={post.id} categories={...} tags={...} city={...} cuisine={...} />
</BlogPost>

// AFTER — named slot renders outside <article>
<BlogPost {...post.data}>
  <Content />
  <RelatedPosts
    slot="related"
    currentId={post.id}
    categories={...}
    tags={...}
    city={...}
    cuisine={...}
  />
</BlogPost>
```

### 2. Named slot receiver in `BlogPost.astro`

Add `<slot name="related" />` immediately after `</article>`:

```astro
  </article>

  <!-- Related posts (rendered outside <article> via named slot) -->
  <slot name="related" />
```

### 3. Final layout order inside `<article>`

```
1. Header (title, date)
2. LocationCard + VenueTags
3. Top AdSlot
4. .prose div → <slot /> (caption/body text)
5. Hero image (loading="eager", fetchpriority="high")
6. In-article AdInArticle
7. Gallery images — full-size stacked (see below)
8. Bottom AdSlot
9. Tags, source attribution
```

Then outside `</article>`:

```
10. <slot name="related" /> → "You might also enjoy"
```

### 4. Replace thumbnail grid with full-size gallery images

The original `ImageGallery` component rendered a CSS grid of 140×140px thumbnails with click-to-new-tab links. Replaced with full-size stacked images using `Promise.all` to resolve WebP siblings and intrinsic dimensions at build time:

```astro
---
// In BlogPost.astro frontmatter:
const galleryImages = [...new Set(images)].filter(img => img !== heroImage);
const galleryInfos = await Promise.all(galleryImages.map(img => getImageInfo(img)));
---

{galleryImages.map((img, i) => {
  const info = galleryInfos[i];
  return (
    <div class="post-image-wrap mt-6 -mx-4 sm:mx-0">
      <picture>
        {info?.webp && <source type="image/webp" srcset={info.webp} />}
        <img
          src={img}
          alt={`${title} — photo ${i + 2}`}
          width={info?.width ?? undefined}
          height={info?.height ?? undefined}
          class="post-image w-full rounded-none sm:rounded-xl shadow-lg"
          loading="lazy"
          decoding="async"
        />
      </picture>
    </div>
  );
})}
```

`Promise.all` keeps build time flat regardless of gallery size. Each image gets correct WebP source and native dimensions (prevents CLS).

## Prevention

### Before adding any component to a layout's slot

1. **Map the slot topology first.** Read the layout file and list every `<slot />` and `<slot name="..." />` along with what wraps each one. Do this before writing caller code.
2. **Named slots for all non-prose content.** RelatedPosts, ad units, comment widgets, newsletter CTAs — any component that is not flowing body text must use a named slot placed *outside* the prose wrapper.
3. **Add a comment above the default slot** in the layout: `{/* prose/body content only — non-body components need a named slot */}`
4. **Audit layout diffs.** When a new component is added to a page, the diff should touch both the caller and the layout. If only the caller changes, check whether the component needs a named slot.

### Debugging "images appear missing" on Astro sites

Work top-to-bottom; stop when you find the cause:

1. **Confirm the element is in the DOM.** If `<img>` is absent → content/rendering bug. If present → layout bug.
2. **Check `src` and network status.** 404 = build pipeline issue. 200 with non-zero response = image loaded fine.
3. **Inspect computed position.** A `top` value in the hundreds/thousands with `position: static` means a preceding element has unexpected height — layout bug, not missing image.
4. **Measure the height of the element immediately before the image.** If a sibling has `min-height`, padding, or unexpected flow content pushing things down, that is your culprit.
5. **Temporarily add `border: 2px solid red` to the image** to confirm it is rendering and locate it in the page flow.
6. **For IG/Wayback post migrations:** After any bulk content change, run a count assertion — `grep -rc '!\[' src/content/posts/ | grep -v ':0'` — to confirm expected state of inline images.

### The Astro named-slot gotcha

Astro's default `<slot />` is greedy — every un-named child of a layout component renders wherever `<slot />` sits, including inside a `.prose` wrapper. There is no automatic routing based on component type or position; only the explicit `slot="name"` attribute does that.

**Critical corollary:** If a caller passes `slot="related"` but the layout has no matching `<slot name="related" />`, the content **silently disappears** — Astro drops unmatched named-slot content with no build warning. Always verify the layout has the receiving slot before adding named-slot content in a caller.

## Related Documentation

- [`front-end-audit-and-image-pipeline.md`](../feature-implementations/front-end-audit-and-image-pipeline.md) — `getImageInfo()` utility, WebP pipeline, CLS baseline
- [`post-enhancements-seo-admin-content-quality.md`](../feature-implementations/post-enhancements-seo-admin-content-quality.md) — original `ImageGallery.astro` construction and `BlogPost.astro` layout history
- [`consent-gated-analytics-adsense.md`](../feature-implementations/consent-gated-analytics-adsense.md) — AdSlot and AdInArticle placement in BlogPost
