---
status: pending
priority: p3
issue_id: "067"
tags: [code-review, quality, typescript, admin]
dependencies: []
---

# ImagePreview: InputProps type doesn't reflect nullable reality; interface diverges

## Problem Statement
Two TypeScript issues in `tina/ImagePreview.tsx`:

1. `InputProps.value` is declared as `string` but `HeroImagePreview` guards with `|| ""`, implying TinaCMS can pass a falsy value. Either the type is wrong or the fallback is dead code. Same for `ImageListPreview`'s `input.value || []` where value is declared `string[]`.

2. `InputProps` is defined at the top of the file but `ImageListPreview` inlines its own anonymous input type in its destructuring signature. `InputProps` is only used by `HeroImagePreview`. This makes `InputProps` look like a shared contract when it isn't.

## Findings
- `tina/ImagePreview.tsx` line 4: `interface InputProps { value: string; ... }`
- `tina/ImagePreview.tsx` line 22: `const src = input.value || ""` — fallback contradicts `string` type
- `tina/ImagePreview.tsx` line 99: `const images: string[] = input.value || []` — same issue, and `string[]` annotation is redundant (TS already infers it)
- TypeScript reviewer: TinaCMS does pass `undefined`/`null` during initial field mount before hydration; the declared types should reflect this

## Proposed Solution

```tsx
interface StringInputProps {
  value: string | null | undefined;
  onChange: (val: string) => void;
}

interface StringListInputProps {
  value: string[] | null | undefined;
  onChange: (val: string[]) => void;
}
```

Remove the redundant `: string[]` annotation on line 99 (TS infers it from the prop type).

## Technical Details
- **File:** `tina/ImagePreview.tsx` lines 4–10, 22, 92, 99

## Acceptance Criteria
- [ ] `InputProps` (or renamed) reflects nullable value type
- [ ] A separate named type exists for the list input contract
- [ ] `|| ""` and `|| []` fallbacks are justified by the type, not in contradiction with it

## Work Log
- 2026-06-09: Identified by TypeScript reviewer in CE review of PR #131
