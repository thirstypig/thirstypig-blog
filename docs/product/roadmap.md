---
id: DOC-005
type: roadmap
status: active
phase: null
owner: james
tags: [docs-system]
links: [DOC-006, DOC-002]
updated: "2026-07-23"
---

# Roadmap

**In plain English:** this is the *macro* list — the handful of big things that would
change what the site is. Each one is weeks of work, not an afternoon. Small immediate
tasks live in `todos.md` (DOC-006) instead.

Nothing here is a commitment or a date. It's a ranked parking lot: when there's time, the
top of this list is what to pick up. An item earns a PRD only after clearing the intake
gate (DOC-003).

> ⚠️ **Two sources of truth right now.** The *live* roadmap the admin board displays is
> hardcoded in `tina/AdminDocs.tsx:752` (`RoadmapSection`). This file holds the **IDs and
> links**; the board is not yet wired to read it. Until it is, prose detail may drift.
> Deliberate — we agreed not to touch app code this session.

---

| ID | Item | Why it matters | Links |
|---|---|---|---|
| **RM-001** | **Venue tags — the long tail** | ~1,105 posts still show no chips. The real blocker is upstream: ~492 posts have no `location` field, so the pipeline can't see them. A backfill likely unlocks more than any scraper work. | PRD-001 |
| **RM-002** | **Bold Red Poster redesign** | The largest unstarted item. Changes the whole visual identity. <!-- TODO(james): no design doc exists anywhere in the repo. Is there one outside it? --> | *needs PRD* |
| **RM-003** | **Comments system** | Would turn a one-way archive into something with a reader loop. The Webmentions/Bridgy path was explored and rejected; an alternative direction is pending. | *needs PRD* |
| **RM-004** | **Photo import — long tail** | 127 MEDIUM + 13 shared-folder + 257 NO_MATCH posts still imageless, plus 1,341 unparsed date-only SSD folders. Recovers images the Wayback archive lost. | *needs PRD* |
| **RM-005** | **Hit List cross-site display** | Show the Hit List on jameschang.co. Documented as "Phase 3" of that feature. | *needs PRD* |
| **RM-006** | **Docs system** | This system. In progress — scaffold now, generated docs and inbox loop next. | DOC-001 |

<!-- Prompt-to-self: keep this list SHORT. A roadmap with 20 items is a wish list, and -->
<!-- a wish list is ignored. If something has sat at the bottom for a year, delete it. -->

## Ranking

**[inferred]** from the project profile, not stated by James:

1. **RM-001** — active work, clear next action, compounding value per sweep
2. **RM-004** — same shape: mechanical, bounded, immediately visible on the site
3. **RM-002** — high impact, high effort, no spec yet
4. **RM-003** — blocked on a direction decision
5. **RM-005** — depends on another codebase

<!-- TODO(james): correct this ranking. It's my read, not your stated priority. -->

## Done

Items flip to `status: done` **in place** — they are not moved or deleted. Nothing has
completed since this file was created.
