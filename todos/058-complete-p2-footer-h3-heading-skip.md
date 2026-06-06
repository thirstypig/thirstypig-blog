---
status: complete
priority: p2
issue_id: "058"
tags:
  - accessibility
  - a11y
  - footer
  - wcag
  - code-review
dependencies: []
---

# Footer `<h3>` Creates WCAG Heading Skip on Posts With No Related Posts

## Problem Statement

The footer column labels (Browse, Discover, Info) were changed from `<p>` to `<h3>` in the previous session for AT heading navigation. However, `RelatedPosts.astro` only renders its `<h2>` ("You might also enjoy") when `scored.length > 0`. On a post with zero related matches, the document heading sequence is h1 → h3 — a two-level skip that fails WCAG 2.1 SC 1.3.1 and the project's own E2E heading-level test.

The E2E test fixture (Stiles Switch, Texas BBQ) has plenty of tags/category/city to score related posts, so CI stays green. But any post without related matches exposes the violation.

## Findings

`tests/e2e/post-page.spec.ts` lines 28–37:
```ts
const levels = await page.$$eval("h1, h2, h3, h4, h5, h6", els =>
  els.map(el => Number(el.tagName.substring(1)))
);
for (let i = 1; i < levels.length; i++) {
  expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
}
```

For a post WITHOUT related posts: heading sequence = [1, 3, 3, 3] → h1→h3 jump of 2 → test fails.
For a post WITH related posts: [1, 2, 3, 3, 3, 3, 3] → all jumps ≤ 1 → test passes.

The Stiles Switch fixture hides the bug. Any other post fixture without related posts would expose it.

Footer nav column labels don't need to be in the document heading outline. The `<nav aria-label="Footer navigation">` landmark already provides AT users with structural context for the footer nav.

## Proposed Solutions

### Option A: Revert to `<p>` + add `aria-labelledby` on each `<ul>` (Recommended)

```html
<p id="footer-browse" class="text-white/40 uppercase tracking-widest text-xs font-medium mb-3">Browse</p>
<ul role="list" aria-labelledby="footer-browse" class="space-y-2 list-none p-0 m-0">
```

This gives AT users "list, Browse, 5 items" when entering each section — the label is announced without being a heading. Screen reader users navigating by heading don't see the footer column labels (correct), but those entering the nav landmark get the group label via `aria-labelledby`.

- **Pros:** No heading skip; still accessible; `role="list"` stays
- **Cons:** Slightly more markup (`id` on each `<p>`, `aria-labelledby` on each `<ul>`)
- **Effort:** XS

### Option B: Keep `<h3>` but add a visually-hidden `<h2>` to the footer

```html
<footer>
  <h2 class="sr-only">Footer</h2>
  ...
  <nav>
    <h3>Browse</h3>
```

Anchors the hierarchy. Feels like a hack.

- **Effort:** XS
- **Risk:** Low, but adds invisible content

### Option C: Use `role="heading" aria-level="3"` on `<p>`

Semantically equivalent to `<h3>` — same heading in the accessibility tree, same skip problem. Does not solve the issue.

## Recommended Action

Option A — revert to `<p>` with `aria-labelledby` pairing. Keeps the visual design identical, restores heading validity, and provides better AT labeling than a bare `<p>` alone (the group label is announced when entering the list).

## Technical Details

**Affected file:** `src/components/Footer.astro` — 3 `<h3>` elements and 3 `<ul>` elements

## Acceptance Criteria

- [ ] Footer column labels are `<p>` elements (not `<h3>`)
- [ ] Each `<ul>` has `aria-labelledby` pointing to its column label `<p>`
- [ ] `role="list"` remains on all three `<ul>` elements
- [ ] `post-page.spec.ts` heading-level test passes on a post fixture with NO related posts
- [ ] E2E footer columns test still passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by kieran-typescript-reviewer and architecture-strategist | RelatedPosts h2 is conditional; h3 in footer creates latent heading skip hidden by the test fixture |
