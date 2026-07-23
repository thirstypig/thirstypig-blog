---
id: DOC-012
type: status
status: active
phase: null
owner: james
tags: [docs-system]
links: [DOC-001]
updated: "2026-07-23"
---

<!-- GENERATED FILE — do not hand-edit.
     Regenerate with: node scripts/sync-inbox.mjs
     Source of truth: docs/_comments.json -->

# Inbox

**12 open** · 1 resolved. Change requests first, then questions, then notes — newest first within each group.

Read this at the start of a session. Act on change requests, answer questions, then write a resolution (note + link) so the item clears. A resolution without a link is indistinguishable from having ignored it.

---

## Change requests (6)

*Something is wrong or missing. These imply work.*

### C-012 — on `DOC-016`

THREE changelogs now exist and none are linked: src/pages/changelog.astro (public, 209 lines hardcoded HTML), tina/AdminDocs.tsx:588 ChangelogSection (admin, hardcoded JSX), and docs/under-the-hood/changelog.md (new). I deliberately left the new one EMPTY rather than copy history into a third place that will drift. Decide which is the single source of truth before populating anything.

<sub>claude · 2026-07-23</sub>

### C-011 — on `DOC-001`

docs/solutions/ui-bugs/astro-named-slot-misplacement-hero-and-gallery-layout.md has INVALID YAML frontmatter and cannot be parsed by js-yaml OR PyYAML. Line 20 is: `  - "You might also enjoy" section appeared between caption text and hero image` — the value opens with a double quote, so YAML reads a quoted scalar and then chokes on the trailing unquoted text. Fix (verified to parse): wrap the whole value in single quotes. NOT APPLIED — needs approval to edit an existing doc. This blocks TD-011, since the file can't be migrated to the new frontmatter convention while it's unparseable.

<sub>claude · 2026-07-23</sub>

### C-001 — on `DOC-010`

docs/testing.md (311 lines) should probably move to docs/engineering/testing-strategy.md so the board indexes one testing doc instead of two. Not done — a file move needs explicit approval. Decide: move it, or keep DOC-010 as a pointer permanently.

<sub>claude · 2026-07-23</sub>

### C-002 — on `DOC-005`

The roadmap ranking (RM-001 through RM-005) is [inferred] from the project profile, not stated by James. Needs correcting to reflect actual priority.

<sub>claude · 2026-07-23</sub>

### C-006 — on `ADR-001` · 🔍 in review

The /admin CSP allows script-src 'unsafe-inline', which weakens it against the exact attack (XSS) that would read the PAT from sessionStorage. Determine whether removing it is possible or whether TinaCMS requires it. Low severity given single-user + scoped token, but it should be a known decision rather than an inherited default.

<sub>claude · 2026-07-23</sub>

### C-007 — on `DOC-008`

Audit what /posts-admin.json, /data-quality.json, /tests-admin.json and /stats.json actually expose. They are publicly fetchable (noindex is obscurity, not access control). If any leak draft titles or unpublished slugs, that warrants a RISK- entry.

<sub>claude · 2026-07-23</sub>

---

## Questions (5)

*Needs an answer — and the answer belongs in the doc, not just in a reply.*

### C-013 — on `DOC-005`

Is the Bold Red Poster redesign shipped or planned? CLAUDE.md lists it as upcoming work, but src/pages/changelog.astro describes "Homepage rebuild as the Bold Red Poster" as DELIVERED in PR #72 — full-bleed red hero, Archivo Black display heading, city picker, light mode only with dark mode deferred. Both can be true (homepage shipped, rest of site not), but roadmap RM-002 currently says unstarted. Needs correcting either way.

<sub>claude · 2026-07-23</sub>

### C-003 — on `PRD-001`

What venue-tag coverage counts as 'done'? Currently 1,022/2,127 posts (48.0%). Nothing in 34 commits or the README states a target, so the PRD records this as [unknown] rather than inventing a number.

<sub>claude · 2026-07-23</sub>

### C-004 — on `PRD-001`

Was tastemakers-ios the primary driver for venue tags, or thirstypig.com? The README names both consumers in one sentence, so the ordering is genuinely ambiguous from the code.

<sub>claude · 2026-07-23</sub>

### C-005 — on `ADR-001`

Was a serverless write-proxy ever weighed as an alternative to holding the PAT in sessionStorage? It would move the token server-side. Also: why do HitListManager and BucketListManager bypass Tina Cloud when post editing uses it?

<sub>claude · 2026-07-23</sub>

### C-008 — on `DOC-001`

Confirm the 5 added type values (solution, guide, plan, brainstorm, audit) and the 13 module tags. Both were proposed, not approved — 33 existing docs cannot be classified without the added types.

<sub>claude · 2026-07-23</sub>

---

## Notes (1)

*For the record. Resolve once acknowledged.*

### C-009 — on `DOC-011`

Project memory (project_post_layout_2026) says ImageGallery.astro 'still exists but is no longer imported'. It has since been deleted from disk with zero references. The memory entry is stale and worth correcting.

<sub>claude · 2026-07-23</sub>

---

## Recently resolved (1)

| ID | Doc | Resolution | Link | When |
|---|---|---|---|---|
| C-010 | `DOC-006` | Captured as TD-001 with a time-sensitive flag, and TD-006/007/008 marked as blocked on it. Also recorded as a general lesson in testing-strategy ugly-case U1. | `DOC-006` | 2026-07-23 |

