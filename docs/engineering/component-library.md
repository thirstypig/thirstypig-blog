---
id: DOC-011
type: component-lib
status: active
phase: null
owner: james
tags: [post-layout, taxonomy, ads-consent, seo]
links: [DOC-007]
updated: "2026-07-23"
---

# Component library

The 14 Astro components in `src/components/`. Props are read from each file's `Props`
interface, not from memory.

**Flat by design.** At 14 components, folders would add indirection without gain. See
DOC-007.

---

## Post rendering

| Component | Props | States / notes |
|---|---|---|
| `PostCard` | `title`, `pubDate`, `slug` (req) · `description?`, `heroImage?`, `categories?`, `tags?` | Renders with or without a hero image |
| `PostGrid` | `posts[]` (id + data object) | Wraps `PostCard` |
| `VenueTags` | `placeId?` | **Renders nothing** when `placeId` is absent *or* the JSON is unreadable — the two are indistinguishable (PRD-001 §9.1). Chips sort by `mention_count` desc. |
| `LocationCard` | `location?`, `city?`, `region?`, `address?`, `coordinates?` | All optional — degrades as fields are missing |
| `RelatedPosts` | `currentId` (req) · `categories?`, `tags?`, `city?`, `cuisine?`, `limit?` | **Must be given `slot="related"`** or it renders inside `.prose` and buries the hero. See decision log 2026-06-04. |
| `FormattedDate` | `date` | — |

## Chrome

| Component | Props | Notes |
|---|---|---|
| `Header` | *none* | Desktop nav is Posts + Cities only |
| `Footer` | *none* | Holds the rest of the nav + "Cookie preferences" |
| `Wordmark` | `discClass?`, `textTag?` (`span\|p`), `textClass?`, `dark?` | Only component with an explicit `dark` prop |
| `Pagination` | `currentPage`, `totalPages`, `baseUrl` | All required |

## Ads — consent-gated

| Component | Props | Notes |
|---|---|---|
| `AdSlot` | `slotId: string \| undefined` | Top + bottom slots |
| `AdInArticle` | `slotId?` | Fluid in-article unit |

Both stay `type="text/plain"` until the `marketing` consent category is granted. Default
is OFF. Three slots per post.

## Data / meta

| Component | Props | Notes |
|---|---|---|
| `SEO` | `title` (req) · `description?`, `image?`, `type?` (`website\|article`), `publishDate?`, `categories?`, `location?`, `address?`, `coordinates?`, `city?`, `region?` | Widest surface here. Truncates meta description to ~157 chars at a word boundary; full text stays in frontmatter + JSON-LD |
| `TagGraph` | `aspectRatio?`, `minHeight?` | — |

---

## Notes

- **`AdSlot` takes `slotId: string | undefined` — required-but-nullable — while
  `AdInArticle` takes `slotId?`.** Same intent, two spellings. Harmless, but it's drift.
- **`Header` and `Footer` take no props**, so nav changes are edits to the component. Fine
  at this size; it's why the 2026-06-04 nav change was a code change.
- **`ImageGallery.astro` was retired** 2026-06-04 — and has since been **deleted from
  disk**, with zero remaining references. Cleanly done; noted here because project memory
  still describes it as "exists but no longer imported," which is now out of date.

<!-- Prompt-to-self: add a "states" column entry whenever a component has a meaningful -->
<!-- empty / loading / error state. VenueTags' silent-null is the case that matters most. -->
