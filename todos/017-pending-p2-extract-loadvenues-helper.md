---
status: pending
priority: p2
issue_id: "017"
tags:
  - code-review
  - simplification
  - venue-tags
dependencies: []
---

# Extract shared `loadAllVenues()` helper (4× duplicated pattern)

## Problem Statement

The same "read every venue-tags JSON" block is hand-rolled in 4 callsites with minor variations:

- `src/components/TagGraph.astro:28-45`
- `src/pages/tags/cloud.astro:22-29`
- `src/pages/tags/map.astro:20-28`
- `src/pages/search.json.ts:9-23`

Each does `fs.existsSync` → `readdirSync` → `filter .json` → `map JSON.parse(fs.readFileSync)`. Type interfaces for `Chip` and `VenueRecord` are also re-declared 4-5× with subtle drift (e.g. `cloud.astro` and `TagGraph.astro` declare `scraped_at` in the interface, `map.astro` doesn't — same data, different shapes).

This is the classic copy-paste outcome of incrementally building features. With 4 callsites it's now worth consolidating.

## Findings

- **Estimated LOC reduction:** ~40 lines across the file set
- **Type drift risk:** real and growing; new fields added to publish.py won't propagate to all consumers
- **Performance:** each callsite re-reads + re-parses the same files at build time. A memoized helper would cut build-time IO ~4×

## Proposed Solutions

### Option A — `src/utils/venue-tags.ts`

Export `loadAllVenues(): VenueRecord[]` and the `Chip`/`VenueRecord` interfaces.

```ts
// src/utils/venue-tags.ts
import fs from 'node:fs';
import path from 'node:path';

export interface Chip { label: string; mention_count: number }
export interface VenueRecord { place_id: string; venue_name: string; city?: string; key?: string; chips: Chip[]; scraped_at?: string }

const VENUE_DIR = path.resolve('public/venue-tags');
let _cache: VenueRecord[] | null = null;

export function loadAllVenues(): VenueRecord[] {
  if (_cache) return _cache;
  if (!fs.existsSync(VENUE_DIR)) { _cache = []; return _cache; }
  _cache = fs.readdirSync(VENUE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(VENUE_DIR, f), 'utf-8')) as VenueRecord);
  return _cache;
}
```

Each callsite collapses to one import + one call.

- **Pros:** single source of truth for shape; build-time memoization; enforced at compile time
- **Cons:** none significant
- **Effort:** Small (well-bounded refactor)
- **Risk:** Low — touches 4 files, all build-time, easy to verify

### Option B — leave as-is, add comment to `publish.py` listing all consumers

- **Pros:** no code changes
- **Cons:** doesn't solve the type-drift; doesn't deduplicate work; still relies on memory
- **Effort:** Tiny
- **Risk:** None

## Recommended Action

(Filled during triage — Option A.)

## Technical Details

- **Affected files:**
  - `src/utils/venue-tags.ts` (new)
  - `src/components/TagGraph.astro` (replace inline read)
  - `src/pages/tags/cloud.astro` (replace inline read)
  - `src/pages/tags/map.astro` (replace inline read)
  - `src/pages/search.json.ts` (replace inline read)

## Acceptance Criteria

- [ ] All 4 callsites use the helper
- [ ] `Chip` and `VenueRecord` interfaces single-defined in the helper
- [ ] No regression on viz pages, search, post-page chips
- [ ] Typecheck passes

## Work Log

(Empty)

## Resources

- `src/components/TagGraph.astro:28-45`
- `src/pages/tags/cloud.astro:22-29`
- `src/pages/tags/map.astro:20-28`
- `src/pages/search.json.ts:9-23`
