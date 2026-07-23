---
id: DOC-016
type: changelog
status: active
phase: null
owner: james
tags: [docs-system]
links: [DOC-005]
updated: "2026-07-23"
---

# Changelog

What shipped, and when.

> ### ⚠️ There are THREE changelogs in this repo
>
> This one makes a third, and none of them are wired to each other:
>
> | Where | Audience | Form | Size |
> |---|---|---|---|
> | `src/pages/changelog.astro` | **Public** — live on the site | hardcoded HTML | 209 lines |
> | `tina/AdminDocs.tsx:588` | Admin only | hardcoded JSX | — |
> | **this file** | Docs board | markdown | new |
>
> **Recommendation: don't populate this file yet.** Copying 209 lines of shipped history
> here creates a third source that will drift from the other two within weeks. The right
> sequence is to pick ONE source of truth first — most likely this file, with both pages
> rendering from it — and only then migrate. Until that decision is made, this page is
> deliberately a pointer.
>
> Logged as an inbox item so it isn't forgotten.

---

## Where to actually look right now

- **Public history:** `/changelog` on the live site, source at `src/pages/changelog.astro`
- **Operator history:** `/admin` → Completed, source at `tina/AdminDocs.tsx`

## Format, once this becomes the source of truth

<!-- Prompt-to-self: newest first. One entry per shipped thing, not per commit. -->
<!-- Link the PR and the PRD it delivered — that's the traceability the other two lack. -->

```
## 2026-07-23 — Docs system scaffold
- Frontmatter convention + 13 module tags (DOC-001)
- Retroactive PRD-001 (venue tags), ADR-001 (static-only)
- Comment-inbox loop + docs:refresh generators
PRs: —   Delivers: RM-006
```

## Entries

*(none — see the warning above)*
