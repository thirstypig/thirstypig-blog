---
id: DOC-009
type: decision-log
status: active
phase: null
owner: james
tags: [docs-system]
links: [ADR-001]
updated: "2026-07-23"
---

# Decision log

One line per **small** decision: `date · decision · why`.

**The split:** if reversing it means rewriting a subsystem, it's an ADR. If it's a
judgment call you'd otherwise forget the reason for in three months, it goes here.
When in doubt, put it here — a one-liner costs nothing.

Newest first.

| Date | Decision | Why |
|---|---|---|
| 2026-07-23 | Docs tags double as feature-module names, fixed at 13 | Gives module isolation and traceability without moving app code; a freeform tag list rots search |
| 2026-07-23 | `updated:` in frontmatter must be **quoted** | Bare dates become Date objects under YAML 1.1 and round-trip out as full ISO timestamps |
| 2026-07-23 | "Done" is a status, never a folder move | Moving files breaks `links` and loses the record |
| 2026-06-09 | Extracted `isSafeSrc` to `src/utils/image-validation.ts` | Made the admin image-preview security guard unit-testable |
| 2026-06-04 | `RelatedPosts` uses a **named** slot | As an unnamed child it rendered inside `.prose`, burying the hero ~1400px down |
| 2026-06-04 | Desktop nav = Posts + Cities only | Everything else moved to footer + mobile hamburger |
| 2026-06-04 | IG posts go caption-first, no inline images | Images render via `heroImage` + gallery; inline tags duplicated them |
| 2026-06-04 | Retired `ImageGallery.astro` | Thumbnail grid replaced by full-size stacked rendering |
| — | Sed-style surgical edits over `yaml.dump` for field-flip migrations | Keeps diffs ~12× smaller across N markdown files |
| — | Google Places replaces Foursquare; Yelp paused | Foursquare returned wrong-business matches; Yelp is IP-blocked |

<!-- Prompt-to-self: add a row the moment you make the call, not later. The value is -->
<!-- entirely in the "why" column — the "what" is recoverable from git, the "why" isn't. -->

## Candidates for promotion to an ADR

Decisions big enough that a one-liner undersells them:

- **ADR-002 — the venue-tags pivot** (2026-04-27): abandoned raw N-gram extraction in
  favour of scraping Google's pre-computed review chips. Unusually well documented in
  `scripts/venue-tags/README.md`, including validation across 5 venues and the discovery
  that Google's clustering beat ours. Costly to reverse; shaped the whole module.
- **ADR-003 — consent-gated GA4 + AdSense** (2026-06-03): reversed the earlier "no
  trackers" removal. Has a solution doc but no ADR.
- **ADR-004 — js-yaml as the authoritative YAML consumer**: constrains every script that
  writes YAML, project-wide.

<!-- TODO(james): confirm these three are worth writing up, and in what order. -->
