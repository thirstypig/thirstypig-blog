---
status: pending
priority: p2
issue_id: "018"
tags:
  - code-review
  - simplicity
  - venue-tags
  - dead-code
dependencies: []
---

# Simplify scripts + delete dead `taxonomy.yaml`

## Problem Statement

Two YAGNI cleanups in the venue-tags pipeline:

1. **`taxonomy.yaml` is dead code** — 161 lines of curated keyword categories that nothing in `scripts/` or `src/` references. The README itself flags it as "kept for now, but largely unused given the pivot below" (line 15). Pipeline pivoted to Google's pre-computed chips; this file's premise is obsolete.

2. **`TagGraph` props are over-parameterized** — `aspectRatio`, `minHeight`, `caption` props exist but only 2 callsites use them, and `caption` only has 2 states (default vs empty). YAGNI violation.

3. **`lookup_place_ids.py` and `scrape_google.py` duplicate** browser-launch + singleton-lock + place_id regex code. Same logic, slightly different function names.

## Findings

### `taxonomy.yaml`
- File: `scripts/venue-tags/taxonomy.yaml` (161 lines)
- README mention: `scripts/venue-tags/README.md:15`
- Grep results: zero references in `scripts/` or `src/`

### `TagGraph` props
- File: `src/components/TagGraph.astro:5-22`
- Caller 1: `src/pages/tags/graph.astro:20` — `<TagGraph />` (defaults)
- Caller 2: `src/pages/map.astro:18` — `<TagGraph aspectRatio="5 / 2" minHeight="320px" caption="" />`

### Script duplication
- `scrape_google.py:55-63` — `clear_stale_singleton_locks()`
- `lookup_place_ids.py:47-49` — `clear_singleton_locks()`
- Both: identical Stealth + persistent_context launch boilerplate
- Both: place_id regex extraction

## Proposed Solutions

**A. Three small focused commits** (recommended)

1. `chore(venue-tags): delete unused taxonomy.yaml`
2. `refactor(venue-tags): simplify TagGraph props` — remove `caption`, hardcode `aspectRatio` default at component level, keep `minHeight` (only real prop with a use case)
3. `refactor(venue-tags): extract _browser.py shared helpers` — singleton cleanup, persistent context launch, place_id regex into `scripts/venue-tags/_browser.py`

Each PR-able independently.

- Pros: small commits, easy to revert; ~250 LOC removed total
- Cons: 3 commits to land
- Effort: Medium
- Risk: Low

**B. One sweep PR**
- Pros: one merge
- Cons: bigger diff, harder to review
- Effort: Medium
- Risk: Low

**C. Defer**
- Cons: dead code accumulates; drift between scripts compounds
- Pros: zero work today
- Effort: None
- Risk: Tech debt grows

## Recommended Action

(Filled during triage)

## Technical Details

- Delete: `scripts/venue-tags/taxonomy.yaml`
- Edit: `src/components/TagGraph.astro`, `src/pages/tags/graph.astro`, `src/pages/map.astro`
- New: `scripts/venue-tags/_browser.py`
- Edit: `scripts/venue-tags/scrape_google.py`, `scripts/venue-tags/lookup_place_ids.py`

## Acceptance Criteria

- [ ] No grep hits for `taxonomy.yaml` after delete
- [ ] `<TagGraph />` and `<TagGraph minHeight="320px" />` both render correctly
- [ ] `lookup_place_ids.py` and `scrape_google.py` both work end-to-end with shared `_browser.py`
- [ ] CI + typecheck pass

## Work Log

(Empty)

## Resources

- PR: #94
