---
status: pending
priority: p3
issue_id: "065"
tags: [code-review, quality, admin]
dependencies: []
---

# ImageListPreview: key={i} on removable list items can scramble focus on delete

## Problem Statement
Both the thumbnail strip and the editable input list in `ImageListPreview` use the array index as the React key. When an item is removed from the middle, React reuses DOM nodes by position — a controlled `<input>` at the old position gets the new value but may lose its focus/cursor state, and the browser may focus the wrong input after deletion.

In practice this only bites if a user is actively typing in an input while clicking remove on a different item — an unlikely interaction. But it's a one-character fix.

## Findings
- `tina/ImagePreview.tsx` lines 155, 192: `key={i}` in both map loops
- TypeScript reviewer + architecture reviewer both flagged independently
- Fix: `key={src || i}` — uses the path string as a stable identity, falls back to index for empty strings

## Proposed Solution

Change both `key={i}` to `key={src + '_' + i}` (the `_i` suffix handles the rare case of two identical paths):

```tsx
{images.map((src, i) => (
  <div key={src + '_' + i} style={{ position: "relative", flexShrink: 0 }}>
```

```tsx
{images.map((src, i) => (
  <div key={src + '_' + i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
```

## Technical Details
- **File:** `tina/ImagePreview.tsx` lines 155, 192
- 2 characters changed per line

## Acceptance Criteria
- [ ] Both map loops use `key={src + '_' + i}` or equivalent stable key
- [ ] Removing an image from the middle of the list does not cause the wrong input to gain focus

## Work Log
- 2026-06-09: Identified by TypeScript reviewer + architecture agent in CE review of PR #131
