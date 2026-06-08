---
title: "Astro Named Slot Escaping Centering Container in BlogPost Layout"
slug: astro-named-slot-centering-container-escape
date: 2026-06-08
category: ui-bugs
severity: p2
tags:
  - astro
  - layout
  - named-slots
  - tailwind
  - mobile-ux
  - responsive-design
components:
  - src/layouts/BlogPost.astro
  - src/components/RelatedPosts.astro
  - src/pages/posts/[...slug].astro
symptoms:
  - '"You might also enjoy" section is flush to the left edge of the viewport on desktop'
  - Section has no side padding on mobile — cards run edge-to-edge
  - Article content above is correctly centered; related posts are not
related:
  - docs/solutions/ui-bugs/astro-named-slot-misplacement-hero-and-gallery-layout.md
---

# Astro Named Slot Escaping Centering Container in BlogPost Layout

## Symptom

The "You might also enjoy" (RelatedPosts) section rendered flush to the left edge of the viewport on desktop, and with no `px-4` side padding on mobile — even though the article content directly above it was correctly centered in a `max-w-3xl mx-auto` column.

## Root Cause

`<slot name="related" />` was placed directly inside `<main class="flex-1">` — outside the `<article class="max-w-3xl mx-auto px-4 sm:px-6">` wrapper. Named slots in Astro render at the slot declaration site in the layout, inheriting layout from their immediate DOM parent. Since the slot's parent was `<main class="flex-1">` (full-width, no centering), RelatedPosts expanded to full viewport width.

```
main.flex-1            ← RelatedPosts rendered HERE (full width)
  article.max-w-3xl    ← Article content (correctly centered)
    h1, body, images
  slot[name=related]   ← Outside article! No max-w-3xl, no px-4
```

This is a follow-up to the named slot *misplacement* bug (see Related docs). The slot was correctly placed *outside* `<article>` to avoid rendering inside `.prose` — but that move also escaped the centering container.

## The Fix

Wrap `<slot name="related" />` in a div that mirrors the article's centering classes:

```diff
  </article>

- <!-- Related posts (rendered outside <article> via named slot) -->
- <slot name="related" />

+ <!-- Related posts — same centering container as <article> above -->
+ <div class="max-w-3xl mx-auto px-4 sm:px-6">
+   <slot name="related" />
+ </div>
```

**File:** `src/layouts/BlogPost.astro`

The wrapper div is always rendered (even when the slot renders nothing), so there are no empty-div concerns.

## Verification

DOM inspection confirmed the fix via JavaScript evaluation in Playwright:

```js
// Before fix
section.parentElement.className  // → "flex-1"
section.getBoundingClientRect().left  // → 0 (flush left)

// After fix
section.parentElement.className  // → "max-w-3xl mx-auto px-4 sm:px-6"
section.getBoundingClientRect().left  // → 273 (correctly indented)
```

At 1280px viewport, a `max-w-3xl` (768px) centered container has margins of `(1280−768)/2 = 256px`, plus `px-6` (24px) padding = 280px from left. Observed 273px ✓.

## Prevention

An E2E test was added to guard this regression:

```typescript
// tests/e2e/post-page.spec.ts
test("'You might also enjoy' section is inside the max-w-3xl container, not flush to viewport edge", async ({ page }) => {
  await page.goto(POST_URL);

  const heading = page.getByRole("heading", { name: /you might also enjoy/i });
  await expect(heading).toBeVisible();

  const isInsideMaxW = await heading.evaluate(el => {
    let node: Element | null = el.parentElement;
    while (node && node.tagName !== "MAIN") {
      if (node.classList.contains("max-w-3xl")) return true;
      node = node.parentElement;
    }
    return false;
  });
  expect(isInsideMaxW).toBe(true);
});
```

### General rules for named slots in Astro layouts

1. **Named slots inherit from their DOM parent in the layout, not the caller.** A slot placed outside a centering container will render uncentered, regardless of how the caller is styled.

2. **Two reasons to use a named slot — and both have layout consequences:**
   - To avoid rendering inside `.prose` (correct — prevents reflowing of non-prose elements)
   - But the slot still needs its own container if it should match the article width

3. **Template for any non-prose component added to BlogPost:**
   ```html
   <!-- Named slot — must have explicit centering wrapper to match article width -->
   <div class="max-w-3xl mx-auto px-4 sm:px-6">
     <slot name="my-component" />
   </div>
   ```

4. **When adding content below `</article>` in a layout, always ask:** does this need to match the article column width? If yes, wrap in `max-w-3xl mx-auto px-4 sm:px-6`.

## Related

- [Astro Named Slot Misplacement: Hero Buried + RelatedPosts Inside Prose](./astro-named-slot-misplacement-hero-and-gallery-layout.md) — The earlier bug where `slot="related"` was missing entirely, causing RelatedPosts to render inside `.prose` between the caption and hero image.
