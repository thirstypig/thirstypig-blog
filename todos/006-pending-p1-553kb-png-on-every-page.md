---
status: pending
priority: p1
issue_id: "006"
tags:
  - code-review
  - performance
  - core-web-vitals
dependencies: []
---

# 553KB hero PNG ships on every page via Header

## Problem Statement

`public/images/redpig-transparent.png` (553KB, 1335×1178) is referenced as a CSS `background-image` in three places:

- `src/components/Header.astro:26` — used to render a **40px** round logo on every page
- `src/pages/index.astro:44` — full-bleed desktop hero
- `src/pages/index.astro:54` — mobile hero (224×224, opacity 0.5)

The Header reuse is the killer: the PNG is downloaded by the browser on every one of the 2061 pages just to render a 40px circle. That's ~553KB of payload per first visit, used to paint a thumbnail-sized icon. The asset bypasses Astro's image optimization pipeline entirely (no WebP/AVIF, no responsive sizes, no `<Image>` component) because it's loaded via raw CSS.

The mobile homepage is the next-biggest waste: 553KB shipped to a phone to render a 224px decorative element at 50% opacity.

## Findings

- `public/images/redpig-transparent.png` is 552,958 bytes, 1335×1178 RGBA
- Header.astro:24-29 — inline `style="background-image: url('/images/redpig-transparent.png'); background-size: 110%"` for a 40px circle
- index.astro:42-46 (desktop hero) and 51-55 (mobile hero) — same asset, different sizes
- Footer.astro also uses it for a 64px circle
- Astro's image pipeline (`<Image>`, `getImageInfo`) is bypassed entirely
- No WebP/AVIF variant exists
- Discovered by performance-oracle during /ce:review

## Proposed Solutions

### Option A: Generate a small WebP for the nav/footer; keep large PNG only for hero

1. Add a step to `scripts/build_favicon.py` (or new `scripts/build_logos.py`) that emits:
   - `redpig-mark-80.webp` (~5KB) — for Header (40px @ 2x) and Footer (64px @ 2x is still under 128px)
   - Keep `redpig-transparent.png` for the homepage hero where 553KB is acceptable
2. Update Header.astro and Footer.astro to point at the small WebP
3. Optionally: convert the hero PNG to WebP too (typically 60–80% smaller for chroma-keyed art)

- Pros: massive win on every-page payload; keeps the hero looking sharp
- Cons: requires CSS background-image to use WebP (well-supported in 2026 — no fallback needed)
- Effort: Small (~30 min)
- Risk: Low

### Option B: Switch hero from CSS background-image to `<img>` / `<picture>`

- Pros: lets Astro's image pipeline + `fetchpriority="high"` apply to the LCP candidate
- Cons: more markup change; absolute-position trick needed to preserve the bleed effect
- Effort: Medium
- Risk: Low

### Option C: Inline the small Header logo as a data URI

- Pros: zero extra requests
- Cons: bloats every HTML response by ~5–10KB; harder to cache; design tokens lose centralization
- Effort: Small
- Risk: Low

## Recommended Action

_To be filled during triage. Option A is recommended._

## Technical Details

Affected files:
- `src/components/Header.astro`
- `src/components/Footer.astro`
- `src/pages/index.astro`
- `public/images/redpig-transparent.png`
- `scripts/build_favicon.py` (extend or sibling script)

Performance impact estimate: 553KB → ~5KB on every-page paint. On mobile, this is the difference between LCP at 2.5s vs ~1.0s on a slow connection.

## Acceptance Criteria

- [ ] Header logo loads <10KB on every page
- [ ] Hero image still renders crisp at full bleed on the homepage
- [ ] No 404s or broken images after asset swap
- [ ] Lighthouse mobile score on `/` does not regress

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Identified during /ce:review | I focused on getting the pig sharper; missed that the same asset got reused for the 40px nav circle. One asset, one decision; should have separated nav-logo from hero from the start. |

## Resources

- `public/images/redpig-transparent.png`
- `src/components/Header.astro`
- `src/components/Footer.astro`
- `src/pages/index.astro`
