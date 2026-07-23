---
id: DOC-017
type: risk
status: active
phase: null
owner: james
tags: [docs-system, build-deploy, admin, venue-tags]
links: [ADR-001, PRD-001, DOC-010]
updated: "2026-07-23"
---

# Risks register

Running list of risks and open questions. Each gets a `RISK-###`, a status, and an owner.

**A risk is something that could cost you the project, the data, or a weekend.** Bugs go
in the issue tracker; this is for things you're *carrying*, not things you're fixing.

Status: `open` · `mitigated` · `accepted` · `closed`.
**`accepted` is a real answer** — many of these aren't worth fixing for a personal
archive, and saying so explicitly is better than leaving them to nag.

---

## Register

| ID | Risk | Impact | Likelihood | Status | Owner |
|---|---|---|---|---|---|
| **RISK-001** | **Photo-import backlog lives in `/tmp`.** 444 pending match decisions were written to `/tmp/photo-matches.csv` on 2026-06-09. macOS purges `/tmp`. If it's gone, the whole matching pass must be re-run. | Medium — rework, not data loss (the SSD is intact) | **High** — six weeks elapsed | `open` | james |
| **RISK-002** | **Venue-tag scraping depends on a hostile third party.** Google gates the Reviews UI behind a signed-in session. `playwright-stealth`, a real Chrome channel, and a persistent profile all failed to defeat it; the pipeline needs a bootstrapped profile and can return exit code 2 at any time. | High — the whole venue-tags feature stops | Medium — it has already broken once | `open` | james |
| **RISK-003** | **Admin PAT sits in `sessionStorage` under a CSP that allows `script-src 'unsafe-inline'`.** That's the exact weakness against the attack (XSS) that would read the token. | Medium — token is user-owned, scoped to Contents R+W on 2 repos | Low — single user, `/admin` is `noindex`, `frame-ancestors 'none'` | `open` | james |
| **RISK-004** | **722 MB of images committed to git** makes every deploy ~10 minutes. Repo size only grows. | Low now, Medium later — throttles iteration speed | Certain — it's the current state | `accepted` | james |
| **RISK-005** | **Non-ASCII data silently disappears at tool boundaries.** Three instances found: `atob`/`btoa` (ADR-001 I1), `\xa0` in SSD folder names, `core.quotePath` hiding 227 CJK filenames from `git ls-files`. A bilingual archive makes every boundary a candidate. | Medium — silent data loss, no error raised | **High** — three occurrences already | `open` | james |
| **RISK-006** | **`/places-hitlist.json` is an uncontracted cross-repo dependency.** jameschang.co consumes it; a field rename breaks that site with no error here. | Medium — breaks another property | Medium — no test guards the shape | `open` | james |
| **RISK-007** | **Admin JSON endpoints leak draft metadata — CONFIRMED (audited 2026-07-23, C-007).** `/posts-admin.json` returns `title`, `id` (slug), `location`, `city`, `source`, and `draft` for **all 441 draft posts** — `getCollection('posts')` with no draft filter. `/data-quality.json` exposes slug+title of suspect posts. `noindex` keeps them out of search but they are freely fetchable. (`/tests-admin.json` = test descriptions, not sensitive; `/stats.json` filters drafts — safe.) | Low — draft titles/locations of a personal food blog, not secrets | Certain — public now | `open` | james |

> **RISK-007 — your call.** Options: (a) **accept** — draft titles on a personal food blog aren't sensitive, and gating them means real auth, which contradicts ADR-001; (b) **mitigate cheaply** — filter `draft` posts out of `stats.json`-style public endpoints but keep them in `posts-admin.json` behind an obscure filename, still not real access control; (c) **don't fix** the Post Manager legitimately needs draft visibility, and there's no server to gate on. Recommendation: **accept** and record it as a known tradeoff of the static architecture. It's the same shape as the PAT-in-sessionStorage call (RISK-003).
| **RISK-008** | **Single maintainer, no bus factor.** Every pipeline is manual, tribal, and undocumented outside this repo. | High for continuity | n/a | `accepted` | james |

<!-- Prompt-to-self: add a row the moment you notice something you're "just living with". -->
<!-- The register is only useful if `accepted` risks are written down too — otherwise -->
<!-- they resurface as surprises. -->

## Open questions

Not risks — things the archaeology couldn't determine. Answering them is homework.

| ID | Question | Where it came from |
|---|---|---|
| **RISK-Q1** | Is the Bold Red Poster redesign **shipped or planned**? `CLAUDE.md` lists it as upcoming; `changelog.astro` describes "Homepage rebuild as the Bold Red Poster" as delivered in PR #72. Both may be true (homepage done, rest of site not) — but the roadmap currently says unstarted. | Contradiction between CLAUDE.md and `src/pages/changelog.astro` |
| **RISK-Q2** | What venue-tag coverage counts as "done"? Currently 48%. | PRD-001 §5a |
| **RISK-Q3** | Was a serverless write-proxy ever weighed, which would move the PAT server-side? | ADR-001 |
| **RISK-Q4** | Should venue chips ever be re-scraped? `scraped_at` is captured and never checked. | PRD-001 §9.5 |
