---
status: pending
priority: p2
issue_id: "010"
tags:
  - code-review
  - quality
  - homepage
  - reproducibility
dependencies: []
---

# regions.ts top-N has non-deterministic tie-break

## Problem Statement

`src/utils/regions.ts:28-31` sorts regions by count descending and slices the top N:

```ts
const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
```

When two regions are tied at the cutoff (e.g., positions 3 and 4 both have 222 posts), JavaScript's `sort` keeps them in `Map` insertion order — which is post-traversal order — which is `getCollection`'s sort order at the call site.

Result: build N and build N+1 can pick *different* regions for the homepage city tiles even when the post data is identical, depending on what triggers the build (post addition, content change in unrelated files, etc.). Today's data has clean separation between top regions, but as the long tail grows or post counts shift, the homepage becomes silently unstable.

The existing tests don't catch this because every test case uses unique counts.

## Findings

- `src/utils/regions.ts:28-31` — `.sort((a, b) => b[1] - a[1])` only
- `src/utils/regions.test.ts` — no test exercises the tied-count path
- Discovered by kieran-typescript-reviewer during /ce:review

## Proposed Solutions

### Option A: Add `localeCompare` secondary sort + a regression test

```ts
.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
```

And add a test:

```ts
it("breaks ties by region name alphabetically (deterministic builds)", () => {
    const result = aggregateRegions([
        post("Bravo"), post("Bravo"),
        post("Alpha"), post("Alpha"),
        post("Charlie"), post("Charlie"),
    ], 2);
    expect(result.top.map(r => r.region)).toEqual(["Alpha", "Bravo"]);
    // Charlie excluded — tie broken by name
});
```

- Pros: deterministic builds; small change; easy test
- Cons: none — strictly better
- Effort: Trivial (5 min)
- Risk: Low

### Option B: Sort by count desc, then by `date_added`-equivalent (newest content first)

- Pros: tiebreaker that has semantic meaning ("favor regions you've posted to recently")
- Cons: requires passing more data into `aggregateRegions`; couples the utility to post structure
- Effort: Medium
- Risk: Low

## Recommended Action

_To be filled during triage. Option A is recommended._

## Technical Details

Affected files:
- `src/utils/regions.ts`
- `src/utils/regions.test.ts`

## Acceptance Criteria

- [ ] Two regions with identical counts produce a stable, deterministic ordering across builds
- [ ] New test in regions.test.ts covers the tie-break path
- [ ] All 7 existing vitest files still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Identified during /ce:review | Pure-function utilities should be deterministic by construction; relying on `Map` iteration order is hidden coupling. |

## Resources

- `src/utils/regions.ts`
- `src/utils/regions.test.ts`
