---
status: pending
priority: p3
issue_id: "068"
tags: [code-review, simplification, admin]
dependencies: [066]
---

# ImagePreview: repeated inline style objects should be named constants

## Problem Statement
`tina/ImagePreview.tsx` repeats the same style values at 4–6 call sites with no shared reference. When a style needs updating (e.g., border color, font size), every occurrence must be found and changed manually. Three style patterns are clearly duplicated across both components.

## Findings
- `border: "1px solid #d1d5db"` — 4 occurrences
- Label style (`fontSize: 13, fontWeight: 600, color: "#374151"`) — duplicated across both components' label blocks
- Empty-state div style (`background: #f3f4f6, border: 1px dashed #d1d5db, borderRadius: 6, color: #9ca3af, fontSize: 13`) — near-identical in both components
- Monospace input style (`fontFamily: "monospace", color: "#374151"`) — duplicated on both inputs

## Proposed Solution

Add named constants before the component definitions:

```tsx
const S_LABEL: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6,
};
const S_EMPTY: React.CSSProperties = {
  background: "#f3f4f6", border: "1px dashed #d1d5db", borderRadius: 6,
  color: "#9ca3af", fontSize: 13, marginBottom: 8,
};
const S_MONO_INPUT: React.CSSProperties = {
  border: "1px solid #d1d5db", borderRadius: 4, fontFamily: "monospace", color: "#374151",
};
```

Estimated reduction: ~25-30 LOC of duplicated style declarations.

Note: best done together with todo #066 (single-map refactor) so the file isn't touched twice.

## Technical Details
- **File:** `tina/ImagePreview.tsx`
- Dependency: can be done standalone or alongside #066

## Acceptance Criteria
- [ ] Shared style values extracted to named constants at file top
- [ ] No inline style object duplicated more than once

## Work Log
- 2026-06-09: Identified by code-simplicity-reviewer agent in CE review of PR #131
