---
id: DOC-004
type: glossary
status: draft
phase: null
owner: james
tags: [docs-system]
links: []
updated: "2026-07-23"
---

# Glossary

Define every project-specific term, acronym, and persona here. If a term appears in more
than one doc and isn't standard English, it belongs on this page.

**Why this matters more than it looks:** a future session (or a future you) reading
"the chips are auth-gated" has no way to recover what that means from context. This page
is the decoder.

---

## Terms

| Term | Means | Where it shows up |
|---|---|---|
| **Chip** | One topic phrase Google pre-computes from a venue's reviews, with a mention count — e.g. `brisket (2,142)`. We scrape these; we do not generate them. | PRD-001, `VenueTags.astro` |
| **FID** | Google Maps "feature ID" — two hex blobs joined by a colon, e.g. `0x8644b5a4ae3bcc33:0x31aba8abf8f64c84`. This is what `placeId` holds, and it's Zod-validated against that exact shape. | `venues.yaml`, post frontmatter |
| **CID** | A different, older Google place identifier. 13 venues have a CID but no FID — they have an identity but the scraper can't reach them. | `venues.yaml` |
| **Auth-gated** | Google served the anonymous "limited view" with no Reviews UI, so no chips could be scraped. `scrape_google.py` exits with code **2**. Fix is re-running `bootstrap_profile.py`. | `scripts/venue-tags/` |
| **Wayback post** | One of 502 posts recovered from Internet Archive captures of the original blog, 2007–2017. Many have no images — the original CDN is gone. | `source:` frontmatter |
| **IG post** | One of 1,184 posts imported from an Instagram data export. Caption-first, images via `heroImage` + gallery. | `source:` frontmatter |

<!-- TODO(james): add the rest. Strong candidates, all of which appear across multiple -->
<!-- docs with no definition anywhere: -->
<!--   Hit List · Bucket List · silent-success failure · the long tail (venue tags) -->
<!--   HIGH/MEDIUM/LOW confidence (photo import) · resource fork · chip drift -->
<!--   Tier 1/2/3 (test cadence) · consent category (analytics vs marketing) -->

## Personas

<!-- TODO(james): this project has no written personas. Two are implied by the code -->
<!-- but never named. Confirm, correct, or delete: -->

| Persona | Who they are | Status |
|---|---|---|
| **The drop-in reader** | Arrives from search on one old post, no context, deciding whether the place is worth a trip today. The venue-tags feature is aimed squarely at them. | **[inferred]** — never written down |
| **You, maintaining** | The only person using the admin. Every admin surface serves this persona. | **[inferred]** |
