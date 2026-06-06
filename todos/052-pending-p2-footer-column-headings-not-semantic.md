---
status: pending
priority: p2
issue_id: "052"
tags:
  - accessibility
  - a11y
  - footer
  - code-review
dependencies: []
---

# Footer Column Headings Use `<p>` — Invisible to Screen Reader Navigation

## Problem Statement

The three footer column labels (Browse, Discover, Info) are `<p>` elements. Screen reader users navigating by heading key (`h` in NVDA/JAWS, Rotor in VoiceOver) cannot jump to these sections. The labels are cosmetically uppercase via CSS but semantically anonymous. Combined with the `<nav aria-label="Footer navigation">` wrapper, AT users can find the nav landmark but cannot navigate within it by section.

## Findings

`src/components/Footer.astro` lines 69, 79, 86:
```html
<p class="text-white/40 uppercase tracking-widest text-xs font-medium mb-3">Browse</p>
<p class="...">Discover</p>
<p class="...">Info</p>
```

`<p>` is body text with no landmark role. ARIA does allow `<h3>` inside `<footer>` — footers sit outside the document heading outline (`<main>`) so heading levels inside `<footer>` don't affect the main content outline.

The E2E test (`static-pages.spec.ts` line 38) uses `getByText("Browse", { exact: true })` which finds ANY element with that text — it passes regardless of tag, so it provides no structural guarantee.

## Proposed Solutions

### Option A: Change `<p>` to `<h3>` (Recommended)

```html
<h3 class="text-white/40 uppercase tracking-widest text-xs font-medium mb-3">Browse</h3>
```

Simple, semantic, correct. `<h3>` inside a `<footer>` `<nav>` is valid HTML and gives AT users heading navigation within the footer.

- **Effort:** XS (3 tag changes)
- **Risk:** Low — purely additive semantic change

### Option B: Add `role="heading" aria-level="3"` to `<p>`

Keeps `<p>` but adds explicit ARIA role. Equivalent outcome, less clean.

- **Effort:** XS
- **Risk:** None

## Recommended Action

Option A — `<h3>` is the correct semantic element. The heading-level-skip E2E test (`post-page.spec.ts` "no skipped heading levels") only runs on post pages, not the footer, so this change won't conflict.

## Technical Details

**Affected file:** `src/components/Footer.astro` lines 69, 79, 86

If the footer data-array refactor (todo #058) ships first, the `<p>` → `<h3>` change goes in the heading field of the navColumns array.

## Acceptance Criteria

- [ ] All three column labels render as `<h3>` elements in the DOM
- [ ] VoiceOver/NVDA users navigating by heading can reach "Browse", "Discover", "Info" in the footer
- [ ] E2E footer columns test still passes (tag-agnostic `getByText` locator)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by kieran-typescript-reviewer and architecture-strategist during code review | `<p>` is invisible to heading navigation; `<h3>` inside `<footer>` is valid ARIA |
