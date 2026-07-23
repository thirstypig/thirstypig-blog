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

**4 open** · 9 resolved. Change requests first, then questions, then notes — newest first within each group.

Read this at the start of a session. Act on change requests, answer questions, then write a resolution (note + link) so the item clears. A resolution without a link is indistinguishable from having ignored it.

---

## Change requests (1)

*Something is wrong or missing. These imply work.*

### C-002 — on `DOC-005`

The roadmap ranking (RM-001 through RM-005) is [inferred] from the project profile, not stated by James. Needs correcting to reflect actual priority.

<sub>claude · 2026-07-23</sub>

---

## Questions (3)

*Needs an answer — and the answer belongs in the doc, not just in a reply.*

### C-003 — on `PRD-001`

What venue-tag coverage counts as 'done'? Currently 1,022/2,127 posts (48.0%). Nothing in 34 commits or the README states a target, so the PRD records this as [unknown] rather than inventing a number.

<sub>claude · 2026-07-23</sub>

### C-004 — on `PRD-001`

Was tastemakers-ios the primary driver for venue tags, or thirstypig.com? The README names both consumers in one sentence, so the ordering is genuinely ambiguous from the code.

<sub>claude · 2026-07-23</sub>

### C-005 — on `ADR-001`

Was a serverless write-proxy ever weighed as an alternative to holding the PAT in sessionStorage? It would move the token server-side. Also: why do HitListManager and BucketListManager bypass Tina Cloud when post editing uses it?

<sub>claude · 2026-07-23</sub>

---

## Recently resolved (9)

| ID | Doc | Resolution | Link | When |
|---|---|---|---|---|
| C-012 | `DOC-016` | Resolved: docs/under-the-hood/changelog.md is now CANONICAL, populated from the former hardcoded content of src/pages/changelog.astro (8 month-sections, 2008-2026). The public /changelog page still hardcodes its own copy — rewiring it to render from the markdown is tracked as TD-013 (markdown-lite.ts renderer already exists for it). | `DOC-016` | 2026-07-23 |
| C-001 | `DOC-010` | Moved. docs/testing.md (311 lines) merged into engineering/testing-strategy.md (DOC-010) as the spine, with the ugly-cases table + docs-system-tests section retained and the two new test files (doc-index, markdown-lite) added to the coverage list. Standalone testing.md deleted (git rm). Stale references in doc-index.ts / CLAUDE.md / README-DOCS.md repointed to testing-strategy.md. | `DOC-010` | 2026-07-23 |
| C-013 | `DOC-005` | Investigated from code + git. The homepage Bold Red Poster SHIPPED (PR #72 merged a0414443; index.astro uses bg-poster-red + font-poster-display + redpig hero; nav renamed in #79). Roadmap RM-002 corrected from unstarted to: homepage done, site-wide rollout pending, dark-mode poster theme deferred. Remaining scope needs james to define. | `DOC-005` | 2026-07-23 |
| C-006 | `ADR-001` | TinaCMS generated /admin/index.html uses inline <script type=module>, so script-src unsafe-inline is REQUIRED, not an oversight. Removing it breaks the admin. Residual risk is bounded by the rest of the CSP (frame-ancestors none, connect-src allowlist), noindex, and single admin user. Recorded as a known tradeoff of the TinaCMS + static setup. | `ADR-001` | 2026-07-23 |
| C-007 | `DOC-008` | Audited all four endpoints. CONFIRMED: /posts-admin.json exposes title/slug/location/city/draft for all 441 drafts; /data-quality.json exposes suspect slug+title; /tests-admin.json and /stats.json are safe (descriptions / draft-filtered). Documented in RISK-007 with accept/mitigate options. Inherent to the static + public-JSON + admin design. | `RISK-007` | 2026-07-23 |
| C-008 | `DOC-001` | Confirmed as-is. The 5 added type values (solution/guide/plan/brainstorm/audit) and the 13 module tags are grounded in the real repo and the board renders 59 docs correctly grouped by them. content-pipeline remains a bag of loose scripts (soft spot, honest as-is). Any tag can still be cut in DOC-001 section 5. | `DOC-001` | 2026-07-23 |
| C-009 | `DOC-011` | Memory corrected: project_post_layout_2026 now states ImageGallery.astro was deleted (was: exists but unimported). New project_docs_board memory added; MEMORY.md index updated. | `DOC-011` | 2026-07-23 |
| C-011 | `DOC-001` | Applied the single-quote wrap to the offending symptoms entry. Now parses cleanly in BOTH js-yaml and PyYAML (verified). Unblocks migrating this file to the frontmatter convention (TD-011). Change is on branch feat/docs-board, pending its follow-up commit. | `DOC-010` | 2026-07-23 |
| C-010 | `DOC-006` | Captured as TD-001 with a time-sensitive flag, and TD-006/007/008 marked as blocked on it. Also recorded as a general lesson in testing-strategy ugly-case U1. | `DOC-006` | 2026-07-23 |

