---
status: pending
priority: p2
issue_id: "062"
tags: [code-review, performance, admin]
dependencies: []
---

# ImageListPreview: every keystroke triggers full O(n) TinaCMS re-render

## Problem Statement
`update()` spreads all N image paths into a new array and immediately calls `input.onChange()` on every keystroke. TinaCMS propagates `onChange` up to its form state, which triggers a full re-render of the entire `ImageListPreview` tree — all N thumbnails + N inputs. At 90 images this makes typing into any path input measurably laggy (~50–200ms per keystroke).

## Findings
- `tina/ImagePreview.tsx` lines 99–104:
```tsx
const update = (index: number, val: string) => {
  const next = [...images];  // spreads all N elements
  next[index] = val;
  input.onChange(next);      // TinaCMS re-renders entire field
};
```
- Every keystroke: O(N) spread + TinaCMS form propagation + React reconcile of N `<input>` elements
- At 90 images: effectively unusable for path editing

## Proposed Solutions

### Option A: Local state + flush on blur (Recommended)
**Effort:** Small | **Risk:** Low

```tsx
const [localImages, setLocalImages] = React.useState<string[]>(input.value || []);

React.useEffect(() => {
  setLocalImages(input.value || []);
}, [input.value]);

const update = (index: number, val: string) => {
  const next = [...localImages];
  next[index] = val;
  setLocalImages(next);       // local only — instant
};

const flush = () => input.onChange(localImages);  // TinaCMS update on blur

// On input: onChange={e => update(i, e.target.value)} onBlur={flush}
```

**Pros:** Typing is instant. TinaCMS only receives updates on blur. ~20 lines of change.
**Cons:** If TinaCMS resets the field externally, the `useEffect` sync handles it.

### Option B: Debounce with setTimeout
**Effort:** Small | **Risk:** Low

Debounce `input.onChange` calls with a 300ms delay.

**Pros:** Simpler than local state.
**Cons:** User who types fast and immediately saves could lose last characters if blur fires before debounce resolves.

### Option C: Accept as-is
In practice, path inputs are rarely typed into (paths are set by import scripts). Most users will never notice the lag because they're not manually editing 90 paths.

**Pros:** Zero code change.
**Cons:** On a 90-image post, editing any path is visibly laggy.

## Recommended Action
Option A if path editing is a real use case. Option C is defensible given paths are programmatically set and rarely hand-edited.

## Technical Details
- **File:** `tina/ImagePreview.tsx` lines 99–104, 192–196

## Acceptance Criteria
- [ ] Typing into any path input does not trigger a TinaCMS-level re-render until blur
- [ ] Values are still committed to frontmatter correctly after blur

## Work Log
- 2026-06-09: Identified by performance-oracle agent in CE review of PR #131
