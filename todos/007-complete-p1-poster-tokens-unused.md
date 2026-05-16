---
status: pending
priority: p1
issue_id: "007"
tags:
  - code-review
  - architecture
  - design-system
  - quality
dependencies: []
---

# Poster design tokens defined but never referenced

## Problem Statement

This session added a "Bold Red Poster" design system to `src/styles/global.css`:

```css
--color-poster-red: #E4152B;
--color-poster-red-deep: #B50E1F;
--color-poster-paper: #FDFBF7;
--color-poster-ink: #1A1413;
--color-poster-muted: #6B635C;
--font-poster: 'Archivo', system-ui, -apple-system, sans-serif;
--font-poster-display: 'Archivo Black', 'Archivo', system-ui, sans-serif;
```

But the consuming code never references them. Instead:
- `#E4152B` is hardcoded ~20× in `index.astro`, ~6× in `Header.astro`, ~5× in `Footer.astro`
- `#1A1413` and `font-family: 'Archivo Black'` are pasted as inline styles throughout
- The `--font-poster-*` tokens are completely unreferenced

This is "design system on paper." Every brand-color rename now requires editing 30+ literal hex strings across 3 files. The tokens add complexity without delivering the benefit they're supposed to.

Additionally, Header.astro and Footer.astro both render the same "red disc + transparent pig PNG centered" pattern with identical inline styles, plus the wordmark (`thirsty<span>pig</span>` in Archivo extrabold). That's a `<Wordmark>` component waiting to happen — used 2× now, will be used by 404 / OG image / email later.

## Findings

- `src/styles/global.css:36-46` — tokens defined but unreferenced
- `src/pages/index.astro` — ~12 inline `style="..."` blocks duplicate the same `clamp(...)` formula and hex literals
- `src/components/Header.astro:24-32` and `src/components/Footer.astro:18-26` — duplicate pig-disc + wordmark markup
- Discovered by code-simplicity-reviewer + kieran-typescript-reviewer (cross-flagged)

## Proposed Solutions

### Option A: Wire tokens into Tailwind utilities + extract Wordmark component

1. Add to `@theme` block (already there) — tokens are exposed as `bg-poster-red`, `text-poster-red`, `font-poster-display`, etc.
2. Replace `style="background: #E4152B"` → `class="bg-poster-red"`
3. Replace inline font-family → `class="font-poster-display"`
4. Extract `<Wordmark size="sm|lg" />` from Header/Footer
5. Optional: extract a custom utility for the hero `clamp(64px, 13vw, 168px)` formula

- Pros: ~60 LOC reduction; one-line theme changes; single source of truth
- Cons: ~30 minutes of careful refactor across 3 files; needs visual verification
- Effort: Medium (~1 hour with eyeball)
- Risk: Low (purely refactor; existing visual output preserved)

### Option B: Remove the unused tokens, accept the inline-style status quo

- Pros: zero work
- Cons: every color change is a 30-file find/replace forever; design intent drifts
- Effort: Trivial
- Risk: High (long-term maintenance debt)

## Recommended Action

_To be filled during triage. Option A is recommended._

## Technical Details

Affected files:
- `src/styles/global.css`
- `src/pages/index.astro`
- `src/components/Header.astro`
- `src/components/Footer.astro`
- New: `src/components/Wordmark.astro`

## Acceptance Criteria

- [ ] No `#E4152B` literals remaining outside `global.css`
- [ ] No inline `style="font-family: 'Archivo Black'"` remaining
- [ ] `<Wordmark>` component used in both Header and Footer
- [ ] Visual output unchanged (verify on / and one interior page)
- [ ] Vercel preview parity check before merge

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Identified during /ce:review | The tokens were added with a clear intent but the consuming code skipped them; classic case of "design system that doesn't get adopted." |

## Resources

- `src/styles/global.css`
- `src/pages/index.astro`
- `src/components/Header.astro`
- `src/components/Footer.astro`
