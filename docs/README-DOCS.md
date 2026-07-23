---
id: DOC-001
type: guide
status: active
phase: null
owner: james
tags: [docs-system]
links: []
updated: "2026-07-23"
---

# How this doc system works

This is the map. Every other file under `docs/` follows the rules on this page.

The goal is a **browsable internal knowledge base** — one place to answer "what did we
build, why, and what broke last time." It is read-only: docs describe the project, they
don't run it.

<!-- SCAFFOLD NOTE: written in Step 2. The comment-inbox model (Step 5a) gets appended
     to the bottom of this file. Nothing else here is placeholder. -->

---

## 1. Every authored doc opens with frontmatter

Without frontmatter, a doc cannot be indexed, filtered, or cross-linked. It becomes
invisible to the board. This one block powers tags, search, the "done" filter, and
traceability.

```yaml
---
id: PRD-001                 # stable ID — never reused, never renumbered
type: prd                   # what kind of doc this is (see §3)
status: draft               # draft | active | locked | done | deprecated
phase: null                 # build phase this relates to, or null
owner: james
tags: [venue-tags]          # module tags ONLY — from the fixed list in §5
links: [ADR-002, DOC-014]   # IDs of related docs — this is the traceability
updated: "2026-07-23"       # QUOTED — bare dates become Date objects in YAML 1.1
---
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Stable forever. If a doc is superseded, mark it `deprecated` — don't reuse its ID. |
| `type` | yes | Controlled list, §3. |
| `status` | yes | Controlled list, §4. |
| `phase` | yes (may be `null`) | Explicit `null` beats a missing key — it says "considered, not applicable." |
| `owner` | yes | Single name. One throat to choke. |
| `tags` | yes | **Module tags only.** No freeform. See §5. |
| `links` | yes (may be `[]`) | IDs, not file paths. Paths move; IDs don't. |
| `updated` | yes | `"YYYY-MM-DD"` — **must be quoted.** Unquoted, YAML 1.1 parses it as a Date object, and a round-trip rewrites it as a full ISO timestamp. See `docs/solutions/build-errors/yaml-round-trip-timestamp-and-utf8-corruption.md`. |

**Rule: the title comes from the first `# H1`, not the filename.** Rename files freely.
Give every doc exactly one H1.

---

## 2. ID scheme

One number block per section. Numbers are assigned in order and never recycled.

| Prefix | Used for | Lives in |
|---|---|---|
| `PRD-###` | Product requirement docs, one per feature | `docs/product/prds/` |
| `ADR-###` | Architecture decisions — big, costly to reverse | `docs/engineering/adrs/` |
| `DOC-###` | Everything else authored (guides, specs, glossary…) | anywhere |
| `RISK-###` | Rows in the risks register | `docs/under-the-hood/risks-register.md` |
| `EXP-###` | Rows in the experiment log | `docs/under-the-hood/experiment-log.md` |
| `RM-###` | Rows in the roadmap (macro items) | `docs/product/roadmap.md` |
| `TD-###` | Rows in the to-do list (micro items) | `docs/product/todos.md` |

`RISK-`, `EXP-`, `RM-`, and `TD-` IDs identify *rows inside* a file, not separate files.
That's deliberate — a risk or a to-do is a line item, not a document. They are still
linkable: a to-do's `links` may name the `RM-` item and `PRD-` it serves.

---

## 3. `type` vocabulary

<!-- DECISION NEEDED: the first block is the originally-specified list. The second block
     is an ADDITION proposed in Step 2 — the original list had no value that fits the 22
     existing docs/solutions/ files, the 3 brainstorms, or the 2 plans. Confirm or cut. -->

**Originally specified:**
`prd` · `launch-spec` · `intake-rules` · `glossary` · `roadmap` · `todos` · `adr` ·
`tech-spec` · `api-docs` · `decision-log` · `testing` · `component-lib` · `changelog` ·
`risk` · `experiment` · `privacy` · `runbook` · `stats` · `costs` · `status`

**Proposed additions** (needed to classify docs that already exist):

| Type | Why it's needed | Covers |
|---|---|---|
| `solution` | The board has a "Troubleshooting / solved problems" section, but no type mapped to it | the 22 files in `docs/solutions/` |
| `guide` | How-to docs that aren't specs | this file, `testing.md`, `new-post-enrichment-cadence.md`, `local-ig-automation.md`, `hitlist-vault-setup.md` |
| `plan` | Forward-looking work plans | `docs/plans/` (2 files) |
| `brainstorm` | Exploratory, pre-decision thinking | `docs/brainstorms/` (3 files) |
| `audit` | Point-in-time assessments | `seo-audit-2026-06-03.md` |

---

## 4. `status` vocabulary

| Status | Means |
|---|---|
| `draft` | Being written. Not trustworthy yet. |
| `active` | Current and accurate. The default for a living doc. |
| `locked` | Frozen by process — changing it requires the feature-intake gate. Used by `launch-spec.md`. |
| `done` | Finished work. Kept for the record, not maintained. |
| `deprecated` | Superseded or wrong. Kept so links don't rot; do not act on it. |

**"Done" is a status, not a folder.** Nothing gets moved or archived when it completes.
It just flips to `status: done` and drops out of the default view via a saved filter.
Moving files breaks links and loses history.

### Migration mapping for docs that already exist

The 21 existing tagged docs use a different status vocabulary. Map as follows:

| Existing value | Becomes | Where |
|---|---|---|
| `resolved` | `done` | `docs/solutions/` |
| `implemented` | `done` | `docs/solutions/` |
| *(absent entirely)* | `done` for solutions, `active` for guides | 15 files currently have no frontmatter at all |

---

## 5. Tags ARE the feature modules

This is the isolation mechanism. **Tags are not topics — they are module names.**
The list below is fixed and derived from the actual repo structure. A doc's tags declare
which module(s) it belongs to, so you can pull an entire module's documentation —
its PRD, its decisions, its solved bugs, its runbook steps — in one query.

**No freeform tags.** A new tag means a new module, which is a deliberate decision:
add it to this table in the same commit, or don't use it. Freeform tags are how search
rots — you end up with `astro`, `astro-slots`, and `slots` all meaning one thing.

| Tag | The module it names | Backed by |
|---|---|---|
| `venue-tags` | Venue chip pipeline — curate → lookup → scrape → publish → sync | `scripts/venue-tags/`, `VenueTags.astro`, `public/venue-tags/`, `src/pages/venue-tags/` |
| `instagram` | IG export import + sync automation | `scripts/instagram/`, `instagram-sync.yml` |
| `photo-import` | SSD photo → post matching and import | SSD matching scripts, `posts-audit.csv` |
| `content-pipeline` | Post enrichment: titles, descriptions, locations, dead-image stripping | the loose `scripts/*.py` enrichment set |
| `admin` | TinaCMS admin surfaces | `tina/` (AdminDocs, PostManager, StatsDashboard, HitListManager, …) |
| `hitlist` | Hit List feature + Obsidian vault sync | `hitlist.astro`, `validate_hitlist.mjs`, `docs/hitlist-*` |
| `seo` | Meta, sitemap, structured data, descriptions | `SEO.astro`, `rss.xml.js` |
| `ads-consent` | Consent banner, GA4, AdSense slots | `AdSlot.astro`, `AdInArticle.astro`, consent config |
| `post-layout` | Post page rendering + related posts | `BlogPost.astro`, `RelatedPosts.astro`, `PostCard`, `PostGrid` |
| `taxonomy` | Browse axes: cities, regions, cuisine, categories, tags, map | `src/pages/{cities,regions,cuisine,categories,tags}`, `map.json.ts`, `TagGraph.astro` |
| `images` | Image pipeline: WebP, dimensions, validation, previews | `image-dimensions.mjs`, `image-validation.ts`, `ImagePreview.tsx` |
| `build-deploy` | Astro/Vercel build, CI, test tiers | `astro.config.mjs`, `.githooks/`, workflows |
| `docs-system` | This documentation system itself | `docs/`, `scripts/refresh-docs.mjs`, `scripts/sync-inbox.mjs` |

13 modules. A doc may carry more than one tag when it genuinely spans modules — but if
everything is tagged with everything, the vocabulary has failed.

<!-- TODO(james): confirm these 13 are the right module boundaries. They were derived
     from directory structure, not from stated intent. `content-pipeline` in particular
     is a bag of 32 loose scripts rather than a real module — it may deserve splitting,
     or may be honest as-is. -->

---

## 6. `links` is the traceability

Link by **ID**, never by file path. A to-do links to the roadmap item and PRD it serves;
a PRD links to the ADRs that constrain it; a solution doc links to the module's PRD.

The payoff: given any ID you can walk outward to everything related, and the refresh
script can flag orphans — a PRD nothing links to, or a link pointing at an ID that
doesn't exist.

---

## 7. What is NOT indexed

- `docs/_templates/` — templates are blanks, not documents
- Anything git-ignored
- `docs/assets/` — images, not docs
- Files with no frontmatter — **these are invisible to the board.** 15 existing docs are
  currently in this state (see §4 migration table).

---

## 8. Generated files — never hand-edit

These are overwritten on every run of `npm run docs:refresh`:

- `docs/under-the-hood/stats.md`
- `docs/under-the-hood/costs.md` — edit `docs/costs.config.json` instead
- `docs/under-the-hood/system-status.md`
- `docs/INBOX.md` — regenerated by `node scripts/sync-inbox.mjs`

Each carries a `GENERATED FILE` warning at the top. Hand edits are lost silently.

---

## 9. Comments and the inbox loop

Docs are read-only in the viewer, but they are not a dead end: you can leave a **comment**
on any doc, and comments flow into `docs/INBOX.md` so a future session picks them up
instead of losing them in chat.

### The comment model

| Field | Values | Notes |
|---|---|---|
| `id` | `C-###` | Stable. Never reused. |
| `doc` | a doc ID (`PRD-001`, `ADR-001`, …) | **Not a file path.** Paths move; IDs don't. |
| `kind` | `question` · `change_request` · `note` | Determines urgency and ordering |
| `status` | `open` → `in_review` → `resolved` | One direction. Reopening means a new comment. |
| `author` | a name | — |
| `created` | ISO 8601 timestamp | Sorting key |
| `body` | free text | The actual comment |
| `resolution` | `{ note, link, resolved_at }` | **Required when `status: resolved`** |

### What each `kind` means

- **`change_request`** — something in the doc is wrong or missing and should change.
  These sort to the **top of the inbox**. They're the only kind that implies work.
- **`question`** — asking for information the doc doesn't answer. Resolving it usually
  means *adding* the answer to the doc, not just replying.
- **`note`** — an observation for the record. No action implied; resolve when acknowledged.

### Resolution is not optional

A comment moves to `resolved` **only** with a resolution note and a link. The link is a
commit SHA (the change that addressed it) or a doc ID (where the answer now lives).

Resolving without a link is how a comment becomes indistinguishable from a comment that
was simply ignored — six months later there's no way to tell which happened.

### Where comments live

Currently `docs/_comments.json`, committed to the repo — a stub so the loop works today.

**There is no database to point this at, and that's by design** (ADR-001). The honest
production path is the one this repo already uses for browser writes: the admin board
appends to `_comments.json` through the GitHub Contents API, exactly like `HitListManager`
does. See the TODO at the top of `scripts/sync-inbox.mjs`.

### The ritual

Documented in CLAUDE.md (added in Step 8): at the start of a session, read
`docs/INBOX.md`, act on `change_request`s, answer `question`s, then write a resolution so
the item clears.
