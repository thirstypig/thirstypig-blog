---
status: pending
priority: p3
issue_id: "012"
tags:
  - code-review
  - quality
  - data
dependencies: []
---

# Region slug collision silently merges entries under the first name seen

## Problem Statement

`src/pages/regions/[region].astro:14-22` builds a map of slug → posts via `slugify(region)`. If two distinct region values slugify to the same string (`"São Paulo"` + `"Sao Paulo"`, `"NYC"` + `"N.Y.C."`, `"Sgv"` + `"SGV"`), they silently merge under the **first one's** display name while the second's posts get appended.

Today's data is clean (top regions are Shanghai / SGV / LA / Taipei — no collisions). But as Instagram-imported posts add more regions over time, this can silently mis-attribute posts under a different display name.

## Findings

- `src/pages/regions/[region].astro:14-22` — collision detection absent
- Discovered by kieran-typescript-reviewer during /ce:review

## Proposed Solutions

### Option A: Warn on collision in getStaticPaths

```ts
const existing = bySlug.get(slug);
if (existing) {
    if (existing.name !== region) {
        console.warn(
            `[regions] slug collision: "${region}" and "${existing.name}" both slugify to "${slug}". ` +
            `Merging under "${existing.name}". Consider canonicalizing the region values.`
        );
    }
    existing.posts.push(post);
} else { /* ... */ }
```

- Pros: surfaces silent collisions in build logs
- Cons: doesn't fix the data; just makes the merge visible
- Effort: Trivial
- Risk: Low

### Option B: Reject builds with collisions

Throw an error instead of warning. Forces canonicalization at the data layer.

- Pros: data integrity guaranteed
- Cons: build breaks on a typo; intrusive for a personal-blog workflow
- Effort: Trivial
- Risk: Medium (build-breaking)

## Recommended Action

_To be filled during triage. Option A is recommended for personal-tinkering scope._

## Technical Details

Affected files: `src/pages/regions/[region].astro`

## Acceptance Criteria

- [ ] Build emits a clear warning if two distinct region values slugify to the same slug
- [ ] No regression on current 38 regions (no false-positive warnings)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Identified during /ce:review | Same defensive pattern as `[category].astro` (which also doesn't warn — could fix both). |

## Resources

- `src/pages/regions/[region].astro`
- `src/pages/categories/[category].astro` (similar pattern)
