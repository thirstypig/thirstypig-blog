---
status: pending
priority: p2
issue_id: "024"
tags:
  - code-review
  - architecture
  - agent-native
  - admin-docs
  - drift
dependencies:
  - "023"
---

# AdminDocs prose duplicates 4+ existing doc surfaces — divergence guaranteed

## Problem Statement

`tina/AdminDocs.tsx` re-states operator knowledge that already lives in
several other places:

| Topic | Where it lives now |
|---|---|
| IG sync workflow | `docs/local-ig-automation.md` + `project_meta_api_wall.md` (memory) + JSX |
| Scraping pipeline | `docs/solutions/api-migration/google-maps-cid-fid-self-healing-scrape.md` + `project_venue_tags.md` (memory) + JSX |
| Yelp status | `scripts/venue-tags/YELP.md` + memory + JSX |
| Status counters | `venues.yaml` + `public/venue-tags/` (filesystem ground truth) + JSX |
| Recent changes | `/changelog` (public Astro route) + git log + JSX |
| Roadmap | `todos/*-pending-*.md` filenames + JSX |

A few facts exist **only in the JSX** and nowhere agent-readable:

- The **API key trap** ("Application restrictions: Websites + empty domain
  list silently 403s") at `tina/AdminDocs.tsx:401-411` — exists in the
  memory `reference_gcp_application_restrictions.md` but not in `docs/`.
- The **`\bpark\b` apostrophe false-match bug** at `:458-465` — not in any
  markdown file.
- The **three genuinely unresolvable venues** at `:472-482` — not in any
  markdown file.

This is "fourth doc surface with no link check, no count assertion" — joins
the silent-fail class.

## Findings

- **Drift originates at the JSX strings** because they're the only doc
  surface a contributor cannot edit from Obsidian/CLI and the only one not
  under any lint or build-time validation.
- **Already disagreeing:** `tina/AdminDocs.tsx:428-441` reports four
  numbers (365/336/320/439); `CLAUDE.md` reports two (320/439) covering an
  overlapping-but-not-identical slice. Neither is wrong yet, but the
  vocabularies differ — first sign of drift.
- The **Roadmap section** at `:602-618` already does the right thing —
  references `todos/015–022` as filesystem paths. That pattern (point at
  the canonical source) should be the rule, not the exception.

## Proposed Solutions

### Option A — Shrink content sections to "see [source]" stubs

Replace `InstagramSection` (`:205-295`) and `ScrapingSection` (`:297-413`)
with 4-line stubs that link to canonical markdown. Keep the headers; drop
the prose. Lift the API-key-trap callout and the `\bpark\b` bug to
markdown first (`docs/operator/api-key-trap.md`,
`docs/operator/curator-bugs.md`) so nothing is lost.

- **Pros:** ~250 LOC deleted; canonical source is markdown (agent + human
  readable); preserves the screen as an index without making it a
  competing source.
- **Cons:** screen becomes much thinner; arguably no longer worth the
  iframe.
- **Effort:** Medium (1 hour for the lift + stubs)
- **Risk:** Low

### Option B — Markdown loader (vite `?raw` + tiny renderer)

Move all five sections to `docs/operator/{ig-sync,scraping,status,
changelog,roadmap}.md`. AdminDocs imports each via `?raw` and renders
through `marked` (or a 30-line custom renderer). Same screen UI; one source
of truth.

- **Pros:** keeps the polished sidebar UI; markdown becomes the canonical
  source; agent and human read the same files.
- **Cons:** new dep (`marked` ~30KB) or 30 lines of custom markdown parser;
  inline-styles need a markdown→inline-styled-JSX shim; still needs the
  build-time count derivation from #023.
- **Effort:** Medium-Large (3–4 hours)
- **Risk:** Medium (markdown rendering edge cases)

### Option C — Delete the screen entirely

Operator is one person who uses Obsidian and CLI. The markdown already
exists. Delete `tina/AdminDocs.tsx` and the `tina/config.ts` registration.

- **Pros:** ~700 LOC deleted; zero drift surface.
- **Cons:** loses the just-shipped feature; loses the at-a-glance roadmap
  view inside admin.
- **Effort:** Small (10 min)
- **Risk:** None — fully reversible via git revert

## Recommended Action

(Filled during triage. Option A is the pragmatic middle. Option B is the
"do it right" answer. Option C is the YAGNI answer; defensible given
audience size.)

## Technical Details

- **Lift-first files (any option):**
  - `docs/operator/api-key-trap.md` — lift from `:401-411`
  - `docs/operator/curator-bugs.md` — lift from `:458-465`
  - `docs/operator/unresolvable-venues.md` — lift from `:472-482`
- **Affected:** `tina/AdminDocs.tsx`, `tina/config.ts` (Option C only)

## Acceptance Criteria

- [ ] No fact lives only in `tina/AdminDocs.tsx`
- [ ] `docs/operator/` (or equivalent) is a complete superset of the
      current admin screen content
- [ ] (Option B) Updating a `.md` file changes the rendered admin screen
      without touching the React component

## Work Log

(Empty)

## Resources

- `tina/AdminDocs.tsx:200-638` (all five sections)
- `docs/local-ig-automation.md` (canonical IG flow)
- `docs/solutions/api-migration/google-maps-cid-fid-self-healing-scrape.md`
  (canonical scraping)
- `scripts/venue-tags/YELP.md` (canonical Yelp playbook)
- `todos/*-pending-*.md` (canonical roadmap)
- Convergent finding from architecture-strategist (P1) +
  agent-native-reviewer (P1) + simplicity-reviewer (P2)
