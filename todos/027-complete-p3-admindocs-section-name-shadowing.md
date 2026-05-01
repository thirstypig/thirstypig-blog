---
status: pending
priority: p3
issue_id: "027"
tags:
  - code-review
  - quality
  - admin-docs
dependencies: []
---

# `Section` name appears twice in `tina/AdminDocs.tsx` with different meanings

## Problem Statement

Two distinct `Section` identifiers in the same file:

- `tina/AdminDocs.tsx:27` — `interface Section { id, label, emoji }` (the
  metadata shape)
- `tina/AdminDocs.tsx:654` — `const Section = SECTION_RENDERERS[active]`
  (a React component reference)

The local const at :654 only exists to satisfy React's "components must be
capitalized" rule — without it, `<SECTION_RENDERERS[active] />` would be
parsed as a literal lowercase tag.

Reader has to disambiguate from context. Cheap to fix.

## Findings

- **Shadowing:** `tina/AdminDocs.tsx:27` (interface) vs `:654` (const).
- **Cause:** indirection added to satisfy capitalization requirement; the
  inline form sidesteps the rule entirely.

## Proposed Solutions

### Option A — Rename local to `ActiveSection`

```tsx
const AdminDocs = () => {
  const [active, setActive] = useState<SectionId>("ig");
  const ActiveSection = SECTION_RENDERERS[active];
  // ...
  <ActiveSection />
};
```

- **Pros:** clearer name; no shadowing.
- **Cons:** none.
- **Effort:** XS (2 min)
- **Risk:** None

### Option B — Inline the call

```tsx
<main style={s.main}>{SECTION_RENDERERS[active]()}</main>
```

- **Pros:** removes the local entirely; one less line.
- **Cons:** less idiomatic React (calling a component as a function rather
  than rendering as JSX); skips React's component-tree integration.
- **Effort:** XS
- **Risk:** Low — works for stateless pure renderers, but worth knowing.

### Option C — Skip

- **Pros:** zero work
- **Cons:** lingering shadowing; trivially fixable

## Recommended Action

(Filled during triage. Option A is the cleanest.)

## Technical Details

- **Affected file:** `tina/AdminDocs.tsx:654, 672`

## Acceptance Criteria

- [ ] Only one `Section` identifier in the file scope

## Work Log

(Empty)

## Resources

- `tina/AdminDocs.tsx:27, 654, 672`
- Finding from kieran-typescript-reviewer (P3)
