---
id: DOC-002
type: launch-spec
status: locked
phase: null
owner: james
tags: [docs-system]
links: [DOC-003, PRD-001]
updated: "2026-07-23"
---

# Launch spec

**Locked.** Changes require the feature-intake process in `feature-intake-rules.md`
(DOC-003). "Locked" does not mean finished — it means the scope boundary is no longer
moved casually. A new idea goes to `roadmap.md`, not into this list.

> **Note on framing.** thirstypig.com is already live and archive-complete (1,686 posts
> published). So this is not a pre-launch plan — it's a **retrospective boundary**: what
> the site *is*, versus what has been deliberately kept out. Treat the IN list as "the
> thing exists and is done," not "we promise to build this."

---

## IN scope — shipped and live

<!-- Prompt-to-self: only list what actually ships today. If it's half-built, it goes -->
<!-- to roadmap.md instead. Verify before adding a bullet. -->

- **The post archive** — 1,686 posts published (502 Wayback-recovered 2007–2017,
  1,184 Instagram 2011–present). 441 drafts not public.
- **Browse axes** — cities, regions, cuisine, categories, tags, map, year/month archive.
- **Venue tags** — 1,022 posts show Google review chips. See PRD-001.
- **Hit List** — a public "to try" list at `/hitlist`, edited through the admin.
- **Search** — client-side over a build-time index.
- **SEO** — per-post meta, structured data, RSS, sitemap.
- **Consent-gated analytics + ads** — GA4 and three AdSense slots per post, both default
  OFF behind a GDPR/CCPA banner.
- **Admin (TinaCMS)** — post editing, Post Manager, Stats Dashboard, Hit List manager,
  Data Quality, this docs board.
- <!-- TODO(james): anything shipped that I've missed? Check against the site nav. -->

## OUT of scope — deliberately not built

<!-- Prompt-to-self: separate "decided against" from "not yet". They are different. -->

**Decided against — do not re-litigate:**

- **Any server-side database or backend.** Static-only is a fixed architectural decision;
  admin writes go through the GitHub REST API from the browser.
- **Framework migration.** Astro + Tailwind v4 + TinaCMS + Vercel is fixed.
- **Foursquare / Yelp as venue sources.** Foursquare replaced by Google Places; Yelp is
  IP-blocked and paused (`scripts/venue-tags/YELP.md`).
- **Meta Graph API for Instagram.** Confirmed dead end for personal-use Pages.
- **`visited` / `date_visited` on the Hit List.** It's a "to try" list, not a log.

**Not yet — lives in `roadmap.md`:**

- Comments system
- Bold Red Poster redesign
- Cross-site Hit List display on jameschang.co
- <!-- TODO(james): add anything else that's been discussed but not committed to. -->

---

## Changing this document

1. Write a PRD that clears the intake gate (DOC-003).
2. Get the PRD to `status: active`.
3. Only then amend the IN list here, and link the PRD id.

Editing the bullets without a PRD is the failure mode this file exists to prevent.
