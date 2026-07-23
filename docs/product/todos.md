---
id: DOC-006
type: todos
status: active
phase: null
owner: james
tags: [docs-system]
links: [DOC-005]
updated: "2026-07-23"
---

# To-dos

**In plain English:** small things that could be done today. If an item needs a plan
before you can start, it isn't a to-do — it belongs in `roadmap.md` (DOC-005).

Every item names the roadmap item it serves. A to-do serving nothing is a hint that
you're doing work nobody asked for.

> ⚠️ **Two sources of truth right now.** The live to-do list the admin board displays is
> hardcoded in `tina/AdminDocs.tsx:470` (`TodoSection`). This file holds IDs and links;
> the board is not yet wired to read it.

---

## Open

| ID | Task | Serves | Notes |
|---|---|---|---|
| **TD-001** | ⏰ **Check whether `/tmp/photo-matches.csv` still exists** | RM-004 | **Time-sensitive.** 444 pending photo-import decisions live only in `/tmp`, which macOS purges on reboot. That file was written 2026-06-09 — six weeks ago. If it's gone, the matching pass must be re-run before any other RM-004 work. Do this first; it's cheap and it gates the rest. |
| **TD-002** | Tighten curator filters before the next sweep | RM-001 | Add `\bservice\b`, `\brepair\b`, `\bauto\b`; fix the apostrophe-in-name false match; cap sentence-shaped values. Details in `docs/operator/curator-bugs.md`. **Do before TD-003**, or the sweep re-surfaces known junk. |
| **TD-003** | Run the next venue-tag sweep | RM-001 | `curate_candidates.py --min-posts 1`. ~30 min, historically yields ~70–90 newly tagged posts. |
| **TD-004** | Reconcile the 48 catalogued-but-unpublished venues | RM-001 | `venues.yaml` has 814 entries; `public/venue-tags/` has 766 files. Nothing surfaces the gap. Surfaced by PRD-001 §9.2. |
| **TD-005** | Add a test for `src/utils/venue-tags.ts` | RM-001 | The only untested file in `src/utils/`, which otherwise keeps strict colocated tests. Its failure mode is silent — bad JSON renders as nothing, with a green build. PRD-001 §8. |
| **TD-006** | Verify the 127 MEDIUM photo matches | RM-004 | Date matched, city didn't. Each folder needs a human look — some are coincidental date collisions. Blocked on TD-001. |
| **TD-007** | Resolve 13 shared-folder photo cases | RM-004 | One folder, multiple posts (e.g. 3 Shanghai restaurants on 2011-06-03). Needs manual photo selection per post. Blocked on TD-001. |
| **TD-008** | Second-pass match on 1,341 date-only SSD folders | RM-004 | Folders named `"April 1, 2007"` with no city prefix were never parsed. Could recover more from the NO_MATCH pool. Blocked on TD-001. |
| **TD-009** | Disambiguate ~199 duplicate post titles | — | SEO P2. Different posts sharing a title string, mostly generic IG captions. |
| **TD-010** | Default `og:image` for the 38 heroless posts | — | SEO P2. Mostly 2009 closed-venue text posts that are genuinely imageless. |
| **TD-011** | Backfill frontmatter on the 15 docs that have none | RM-006 | They are invisible to the board until they have it. See DOC-001 §4. |
| **TD-012** | Decide: commit or gitignore `posts-audit.csv` + `venue-tags-todo.csv` | RM-006 | Both are untracked pipeline inputs sitting in the repo root. Same `/tmp` lesson as TD-001 — pipeline memory shouldn't live somewhere disposable. |

<!-- Prompt-to-self: if an item sits here more than a couple of months untouched, it's -->
<!-- not actually a to-do. Move it to roadmap.md or delete it. -->

## Done

Items flip to `status: done` **in place** — never moved to another file. Moving breaks
links and loses the record of what was actually finished.

*(none yet — this file was created 2026-07-23)*
