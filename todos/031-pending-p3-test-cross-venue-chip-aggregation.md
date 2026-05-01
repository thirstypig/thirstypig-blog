---
status: pending
priority: p3
issue_id: "031"
tags:
  - testing
  - venue-tags
  - tag-cloud
dependencies:
  - "017"
---

# Add unit test for cross-venue chip aggregation in tag cloud

## Problem Statement

`src/pages/tags/cloud.astro:10-25` contains the cross-venue aggregator —
the block that takes per-venue chip arrays and produces the global
"hottest tags across the whole site" view via a `Map<label, {total,
venueCount}>` reducer:

```ts
for (const v of venues) {
	for (const chip of v.chips) {
		const existing = aggregate.get(chip.label);
		if (existing) {
			existing.total += chip.mention_count;
			existing.venueCount += 1;
		} else {
			aggregate.set(chip.label, {
				label: chip.label,
				total: chip.mention_count,
				venueCount: 1,
			});
		}
	}
}
```

This is the only code that turns 319 per-venue JSONs into the unified
cloud, and it has zero unit-test coverage. Currently it's only exercised
end-to-end by `tests/e2e/tag-cloud.spec.ts` (the popularity-sort guard),
which catches catastrophic failure but cannot distinguish "label sums
correctly across 5 venues" from "label appears once and we got lucky."

## Findings

- File: `src/pages/tags/cloud.astro:10-25`
- Coupling: aggregator runs inside Astro frontmatter; not callable from
  Vitest as-is. Either (a) extract to `src/utils/aggregate-chips.ts` and
  unit-test there, or (b) add an Astro server-render harness (heavier).
- Behavior to encode in tests:
  1. Same label at 2+ venues sums their `mention_count` values
  2. `venueCount` increments per venue, not per chip occurrence
  3. Label uniqueness is case-sensitive (today's behavior — verify intent)
  4. Empty `chips: []` arrays from mainland-China venues don't crash
  5. Output stable sort by `total` desc (currently happens at line 27)

## Proposed Solutions

### Option A — Extract `aggregateChips(venues)` to `src/utils/aggregate-chips.ts`

Pure function, well-typed, easy unit test. Mirrors the pattern todo #017
proposes for `loadAllVenues()`.

```ts
// src/utils/aggregate-chips.ts
import type { VenueRecord } from './venue-tags'; // (todo #017 establishes this)
export interface AggregatedChip { label: string; total: number; venueCount: number }

export function aggregateChips(venues: VenueRecord[]): AggregatedChip[] {
	const map = new Map<string, AggregatedChip>();
	for (const v of venues) {
		for (const chip of v.chips) {
			const existing = map.get(chip.label);
			if (existing) {
				existing.total += chip.mention_count;
				existing.venueCount += 1;
			} else {
				map.set(chip.label, { label: chip.label, total: chip.mention_count, venueCount: 1 });
			}
		}
	}
	return [...map.values()].sort((a, b) => b.total - a.total);
}
```

Companion test: `src/utils/aggregate-chips.test.ts` with ~5 cases.

- **Pros:** unit-tested in isolation; complements todo #017's loader extraction; replaces the E2E "≥5 chips" smoke with a precise assertion
- **Cons:** small new file; depends on #017 landing first for shared `VenueRecord` type
- **Effort:** Small (~30 min)
- **Risk:** Low — pure refactor

### Option B — Test via Astro container API

Use `experimental_AstroContainer` to render `cloud.astro` with a stub
venues array and assert on the output HTML.

- **Pros:** tests the actual integration
- **Cons:** much heavier setup; brittle to template tweaks; slow
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

Option A, sequenced after todo #017 lands so both extractions share the
`VenueRecord` interface from `src/utils/venue-tags.ts`.

## Technical Details

- New: `src/utils/aggregate-chips.ts`, `src/utils/aggregate-chips.test.ts`
- Edited: `src/pages/tags/cloud.astro` (replace inline block with import)
- E2E test `tests/e2e/tag-cloud.spec.ts` may have its "≥5 chips" smoke
  case retired once unit coverage is in place; keep the popularity-sort
  cell as the integration-level guard.

## Acceptance Criteria

- [ ] `aggregateChips()` exported from `src/utils/aggregate-chips.ts`
- [ ] `cloud.astro` imports the helper instead of inlining the loop
- [ ] At least 5 unit tests cover: cross-venue summing, venueCount per
      venue, sort order, empty-chips venues, single-venue label
- [ ] `npm run typecheck` clean
- [ ] `tests/e2e/tag-cloud.spec.ts` still passes

## Work Log

(Empty)

## Resources

- `src/pages/tags/cloud.astro:10-25` — current inline aggregator
- `tests/e2e/tag-cloud.spec.ts` — current end-to-end coverage
- todo #017 — extracts the file-loader (logical companion to this work)
