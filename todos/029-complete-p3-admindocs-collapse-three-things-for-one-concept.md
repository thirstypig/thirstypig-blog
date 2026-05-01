---
status: pending
priority: p3
issue_id: "029"
tags:
  - code-review
  - simplicity
  - admin-docs
dependencies: []
---

# `SectionId` + `SECTIONS` + `SECTION_RENDERERS` — three things for one concept

## Problem Statement

`tina/AdminDocs.tsx` defines three coupled artifacts that all describe the
same thing:

- `tina/AdminDocs.tsx:20-25` — `type SectionId = "ig" | "scraping" | ...`
- `tina/AdminDocs.tsx:27-31` — `interface Section { id, label, emoji }`
- `tina/AdminDocs.tsx:33-39` — `const SECTIONS: Section[] = [...]`
- `tina/AdminDocs.tsx:644-650` — `const SECTION_RENDERERS:
  Record<SectionId, () => ReactElement> = { ig: ..., scraping: ..., ... }`

For five static sections, three coordinated registries (with two
co-indices on string keys) is more ceremony than the data shape needs.
Adding a sixth section requires editing four locations: the `SectionId`
union, `SECTIONS`, `SECTION_RENDERERS`, and the corresponding section
component.

## Findings

- **Coupled artifacts:** `:20-25, :33-39, :644-650`.
- **Type-safety win retained even after collapse:** TS will still catch a
  missing render function via array exhaustiveness against a literal-array
  inferred type.
- **Kieran's offsetting note:** the `Record<SectionId, ...>` map is
  actually praised as "the cleanest dispatch pattern in the `tina/`
  directory" — the exhaustiveness check is genuinely valuable. So
  collapsing has a real cost: losing the compile-time guarantee that
  every variant has a renderer.

## Proposed Solutions

### Option A — Collapse to a single array of `{id, label, emoji, render}`

```tsx
const SECTIONS = [
  { id: "ig", label: "Instagram sync", emoji: "📸",
    render: InstagramSection },
  { id: "scraping", label: "Venue-tags scraping", emoji: "🏷️",
    render: ScrapingSection },
  { id: "status", label: "Pipeline status", emoji: "📊",
    render: StatusSection },
  { id: "changelog", label: "Recent changes", emoji: "📝",
    render: ChangelogSection },
  { id: "roadmap", label: "Roadmap", emoji: "🗺️",
    render: RoadmapSection },
] as const;

type SectionId = typeof SECTIONS[number]["id"];
```

- **Pros:** one source of truth; ~15 LOC saved; literal `as const` array
  derives `SectionId` automatically.
- **Cons:** loses the explicit `Record<SectionId, ...>` exhaustiveness
  check — adding a new ID without a render function now passes type-check
  silently (the array-driven approach doesn't enforce coverage).
- **Effort:** Small (15 min)
- **Risk:** Low

### Option B — Keep current shape, add a comment explaining the trade

The exhaustiveness check is genuinely valuable for catching "I added an ID
and forgot a renderer." Keep the three-thing shape; add a one-line
comment about why.

- **Pros:** preserves type guarantee; no behavior change.
- **Cons:** ceremony stays; new contributors still have to edit 4 places.
- **Effort:** XS
- **Risk:** None

### Option C — Skip

- **Pros:** zero work
- **Cons:** ceremony lingers

## Recommended Action

(Filled during triage. Lean Option B — Kieran's praise of the
exhaustiveness check makes Option A a net loss. Worth keeping the current
shape with a comment explaining the trade. Only collapse if the section
list grows so much that the four-edit churn matters.)

## Technical Details

- **Affected file:** `tina/AdminDocs.tsx:20-39, 644-650`

## Acceptance Criteria

- [ ] Either: all section metadata in one place AND adding a section
      requires editing one location, OR: a comment justifies the current
      three-thing shape on type-safety grounds

## Work Log

(Empty)

## Resources

- `tina/AdminDocs.tsx:20-39, 644-650`
- Finding from code-simplicity-reviewer (P3)
- Counter-finding from kieran-typescript-reviewer (the
  `Record<SectionId, ...>` exhaustiveness pattern is praised)
