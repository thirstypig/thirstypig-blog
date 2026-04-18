---
title: "Front-end audit: WebP delivery, contrast, accessibility, and bundle hygiene"
date: 2026-04-17
category: feature-implementations
tags:
  - performance
  - accessibility
  - wcag
  - image-pipeline
  - remark-plugin
  - tailwind
  - design-tokens
  - leaflet
  - fontsource
components_affected:
  - src/plugins/remark-image-optimize.mjs
  - src/utils/image-dimensions.mjs
  - src/components/PostCard.astro
  - src/components/Header.astro
  - src/layouts/BlogPost.astro
  - src/layouts/BaseLayout.astro
  - src/styles/global.css
  - src/pages/map.astro
  - src/pages/search.astro
  - src/pages/search.json.ts
prs:
  - "#34"
  - "#35"
  - "#36"
  - "#37"
  - "#38"
  - "#39"
  - "#40"
status: implemented
---

# Front-end audit: WebP delivery, contrast, accessibility, and bundle hygiene

## Overview

Seven PRs shipping the findings from a senior front-end audit covering page weight,
WCAG 2.0 contrast, WCAG 2.2 accessibility, responsive UX, and interactive behavior.
Ordered smallest-risk-first so each merge was independently reviewable and revertible.

| PR | Focus | Key change |
|---|---|---|
| #34 | Quick wins | 25 KB JPG logo → 650 B SVG; `scroll-padding-top`; deindex `/posts-admin.json`; delete orphaned `BaseHead.astro` |
| #35 | Image pipeline | Remark plugin emits `<picture>` with WebP + dimensions for every markdown image; shared `getImageInfo()` util for Astro components |
| #36 | Accessibility | Skip link, ARIA state sync, `:focus-visible`, `prefers-reduced-motion` |
| #37 | Contrast | Design-token edits lift `--color-stone` and dark-mode `--color-amber` to AA; `prefers-contrast` override |
| #38 | Map hardening | Bundle Leaflet via npm; dashed hollow rings for closed venues; legend |
| #39 | Build cleanup | Latin-only `@fontsource` imports (66 font files → 12); print stylesheet |
| #40 | Search WebP | Build-time `getImageInfo()` bakes WebP + dimensions into `/search.json` so client-rendered cards also use `<picture>` |

## Problems

### 1. 7,503 pre-computed WebP files were sitting unused

Every post had a sibling `.webp` generated at content-import time, but every `<img>`
tag in every rendered page pointed at the `.jpg`. The files were dead weight on the
CDN and the browser paid the full JPG cost on every page load.

### 2. Markdown images shipped without dimensions, `loading`, or `decoding` attrs

Astro's image optimization only runs on images imported via JS or rendered through
`<Image />`. Our 2,120 posts use markdown `![]()` syntax which lowers to plain
`<img>`. A sample post had 9 body images totaling ~2.2 MB, all loaded eagerly with
no dimensions — so 9 images raced for bandwidth above the fold, producing a
high-CLS, high-LCP mess on mobile.

### 3. Several WCAG AA contrast failures in both themes

`text-stone` (#78716C on cream) was 4.3:1 — just under the 4.5:1 AA threshold for
normal text. Used on nav, dates, descriptions — widespread. Dark-mode `text-amber`
(#D97706 on #3A3A3A) was also 4.3:1, affecting every link.

### 4. Accessibility gaps

No skip link. No `aria-current`/`aria-expanded`/`aria-pressed` on nav controls.
No `:focus-visible` rule (some inputs had `focus:outline-none` without a
replacement). No `prefers-reduced-motion` override for the global
`scroll-behavior: smooth`.

### 5. Leaflet loaded from `unpkg.com`

External CDN dependency on the map page: no SRI, extra DNS/TLS handshake, supply
chain risk.

### 6. Font bloat

`@fontsource/inter/400.css` and siblings bundle every subset — Cyrillic,
Cyrillic-ext, Greek, Greek-ext, Vietnamese, Latin, Latin-ext — for content that's
99% English. Browsers never fetched the non-Latin subsets (`unicode-range` filters
them), but the files still shipped to Vercel's CDN: 66 font files / ~1.1 MB.

## Solutions

### Image pipeline architecture

The core insight: every image surface on the site needs the same three things —
a WebP source, explicit width/height, and lazy loading. Different rendering paths
need different tools.

**Shared utility** — `src/utils/image-dimensions.mjs`:

```js
export async function getImageInfo(src) {
  // Reads sharp metadata, checks for a sibling .webp, caches to disk by (path, mtime).
  // Returns { src, webp, width, height } — nulls trigger a plain <img> fallback.
}
```

Cache persists to `.astro/image-dimensions.json`. Flushed every 100 writes plus
on `beforeExit` / `exit` / `SIGINT` / `SIGTERM` — Astro's build sometimes exits
via `process.exit()`, which **skips** `beforeExit`, so redundant handlers are
required. Once warm, incremental builds don't re-read the ~1,500 unique images.

**Three consumer paths, one utility:**

1. **Markdown body images** (remark plugin, `src/plugins/remark-image-optimize.mjs`):

   ```js
   visit(tree, 'image', (node, index, parent) => {
     const info = await getImageInfo(node.url);
     parent.children[index] = {
       type: 'html',
       value: `<picture><source type="image/webp" srcset="${info.webp}"><img ... width="${info.width}" height="${info.height}" loading="lazy" decoding="async"></picture>`,
     };
   });
   ```

   Falls back to plain `<img>` when dimensions can't be read, so a missing file
   never breaks the post.

2. **Astro-frontmatter components** (PostCard, BlogPost hero): call `getImageInfo()`
   directly in the component's frontmatter script, then render `<picture>` JSX.

3. **Client-rendered search results** (`/search.astro`): can't call sharp in the
   browser, so we bake `heroWebp`, `heroWidth`, `heroHeight` into `/search.json`
   at build time in `search.json.ts`. Client-side renderer reads them and emits
   the same `<picture>` HTML.

### Design tokens do the heavy lifting for contrast

The audit flagged several WCAG AA failures. Because everything in the site reads
from CSS custom properties (no hard-coded hexes in components), fixing contrast
was a two-line change:

```css
/* light mode */
--color-stone: #655F5B;   /* was #78716C — now 5.6:1 on cream */

/* dark mode */
[data-theme="dark"] {
  --color-amber: #F59E0B; /* was #D97706 — now 5.3:1 on #3A3A3A */
}
```

Plus `@media (prefers-contrast: more)` which promotes muted tones to the primary
ink value for OS-level high-contrast users.

### Accessibility: batched in one PR

All a11y changes live in 2-3 files, so they go together cleanly:

- Skip link in `BaseLayout.astro` (`sr-only focus:not-sr-only` Tailwind pattern)
- `Header.astro` refactored from 14 near-identical `<a>` blocks into a single
  `navItems` data array + `.map()`. `aria-current="page"` on the active link.
  Trailing-slash normalized so `/hitlist/` matches `href="/hitlist"`.
- `aria-expanded` on mobile menu button (synced to the `hidden` class toggle)
- `aria-pressed` + dynamic `aria-label` on the theme toggle (so screen readers
  announce the action, not just the current state)
- `:focus-visible` rule in `global.css` — 2 px amber with 2 px offset, sitewide
- `@media (prefers-reduced-motion: reduce)` disables `scroll-behavior: smooth`
  and snaps transitions to 0.01ms

### Font subset pruning

Single-line change per import:

```css
/* before */
@import "@fontsource/inter/400.css";

/* after */
@import "@fontsource/inter/latin-400.css";
```

Result: 66 font files → 12 files, ~1.1 MB → 324 KB in `dist`. Browsers never
fetched the non-Latin subsets (thanks to `unicode-range`), but we were still
paying CDN origin storage + bandwidth for every build's deploy.

### Map page: bundle Leaflet

`npm install leaflet @types/leaflet` then:

```ts
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
```

Astro emits content-hashed `_astro/leaflet.*.js` + `.css` served from the same
origin. 151 KB raw / 44 KB gzipped, comparable to what unpkg served, but with
long-lived cache, no external DNS, no SRI risk.

Closed venues now use a dashed hollow ring (`fillOpacity: 0, dashArray: "2 2"`)
instead of only-color differentiation — red-green CVD users can now distinguish
open vs closed markers.

## Patterns worth remembering

1. **The shape of the image pipeline** — one async utility (`getImageInfo()`),
   three consumer paths (remark, Astro SSR, build-time JSON). Anytime a new
   image surface appears, it plugs into the same utility.

2. **Design tokens pay off quadratically when you need to fix something
   systemic.** Two `--color-*` edits fixed contrast across hundreds of
   component usages. Tokens are worth the upfront structural cost.

3. **Astro's exit sequence doesn't reliably fire `beforeExit`.** Any build-time
   cache needs multiple exit handlers plus a throttled flush interval.

4. **`@fontsource` non-suffixed imports are a subtle trap.** Always reach for
   `latin-*` (or whatever subset your content needs) unless you're shipping
   multi-script content.

5. **Client-rendered surfaces can still get build-time optimization** if you
   move the work into the JSON they fetch. PR 40 did +14 KB once, saved ~700 KB
   per user session — a fair trade anytime a build-time value is expensive to
   recompute in JS.

6. **Compute once at build, serve everywhere** — generalization of point 5.
   Whenever a client feature needs data the build already knows, prefer baking
   it in over shipping JS to recompute it.

## Expected metrics (post-deploy)

| Metric | Before | After |
|---|---|---|
| Mobile post-page Lighthouse Performance | ~45 | ~78 |
| Mobile post-page LCP | ~5 s | ~2 s |
| CLS | ~0.22 | <0.05 |
| Lighthouse Accessibility | ~85 | ~96 |
| Font bytes shipped in `dist` | ~1.1 MB | 324 KB |
| Header logo bytes | 25 KB JPG | 650 B SVG |

Field metrics via Google Search Console / Vercel Analytics should confirm these
48–72 h after the first deploy rolls out.

## Deferred

- **woff fallback removal.** `@fontsource` bundles woff + woff2 in the same
  `src:` declaration; stripping woff requires writing custom `@font-face`
  rules that duplicate the unicode-range map. Modern browsers never fetch
  woff; it's ~162 KB of dead dist bytes at zero runtime cost.
- **BaseLayout named `<head>` slot** — would unlock per-page `<link rel="preconnect">`
  for things like the OSM tile server.
- **Post gallery alt text distinctiveness** — every image in a post currently
  shares `alt={title}`. Content-level task, not code.
