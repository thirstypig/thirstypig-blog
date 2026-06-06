---
status: pending
priority: p2
issue_id: "053"
tags:
  - accessibility
  - a11y
  - footer
  - safari
  - code-review
dependencies: []
---

# `list-none` Strips List Semantics in Safari + VoiceOver

## Problem Statement

Safari + VoiceOver removes the implicit `role="list"` from a `<ul>` when `list-style: none` is applied. This is documented WebKit behavior — designed to suppress spurious "list" announcements on purely decorative lists. The footer nav columns use genuine navigation lists (Browse: 5 items, Discover: 2 items, Info: 3 items) where AT users benefit from knowing item counts. Safari VoiceOver will silently strip the list semantics.

## Findings

`src/components/Footer.astro` lines 70, 80, 87:
```html
<ul class="space-y-2 list-none p-0 m-0">
```

Tailwind's `list-none` applies `list-style: none`, which triggers Safari's semantic stripping. The `<nav aria-label="Footer navigation">` wrapper helps AT users find the nav but doesn't restore the list role on its children.

This is the same pattern flagged in the project's front-end audit and is consistent with WCAG 1.3.1 (Info and Relationships).

## Proposed Solutions

### Option A: Add `role="list"` to each `<ul>` (Recommended)

```html
<ul role="list" class="space-y-2 list-none p-0 m-0">
```

Explicitly restores the list role that Safari strips. This is the standard fix documented at https://www.scottohara.me/blog/2019/01/12/lists-and-safari.html.

- **Effort:** XS (3 additions, one per column)
- **Risk:** None

### Option B: Remove `list-none`, use custom marker suppression

Replace `list-none` with a CSS custom property or `marker { display: none }` approach that suppresses visual bullets without removing list semantics. More complex, same result.

- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A — `role="list"` is the canonical fix, one attribute per `<ul>`.

## Technical Details

**Affected file:** `src/components/Footer.astro` — 3 `<ul>` elements (lines 70, 80, 87)

If the footer data-array refactor (todo #058) ships, the `role="list"` goes on the single template `<ul>` in the map.

## Acceptance Criteria

- [ ] All three footer `<ul>` elements have `role="list"`
- [ ] Safari + VoiceOver reads each column's items with count (e.g., "list, 5 items")
- [ ] Visual appearance unchanged
- [ ] E2E footer columns test still passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by kieran-typescript-reviewer during code review | Safari strips list semantics on list-none; explicit role="list" is the fix |
