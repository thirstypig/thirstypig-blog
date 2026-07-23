---
id: DOC-008
type: api-docs
status: active
phase: null
owner: james
tags: [build-deploy, admin]
links: [DOC-007, ADR-001]
updated: "2026-07-23"
---

# API docs

**Read this first: there is no server API.** This site is static (ADR-001). Everything
below is a **JSON file generated at build time** and served from the CDN. Nothing accepts
input, nothing authenticates, nothing has a request body. `GET` is the only method, and
the "inputs" column is empty by design.

The one genuine HTTP API this project calls is GitHub's, from the admin — documented at
the bottom.

---

## Build-time JSON endpoints

Nine, all in `src/pages/`. Each exports `GET` and is evaluated once per build.

| Path | Source | Purpose | Auth | Headers |
|---|---|---|---|---|
| `/search.json` | `search.json.ts` | Client-side search index | none | — |
| `/map.json` | `map.json.ts` | Venue coordinates for the map | none | — |
| `/regions.json` | `regions.json.ts` | Region groupings | none | — |
| `/stats.json` | `stats.json.ts` | Feeds the admin Stats Dashboard | none | — |
| `/data-quality.json` | `data-quality.json.ts` | Feeds the admin Data Quality screen | none | — |
| `/tests-admin.json` | `tests-admin.json.ts` | Feeds the admin Testing Dashboard | none | — |
| `/posts-admin.json` | `posts-admin.json.ts` | Feeds the admin Post Manager | none | `X-Robots-Tag: noindex` · `Cache-Control: private, max-age=300` |
| `/places-hitlist.json` | `places-hitlist.json.ts` | **Cross-origin** — consumed by jameschang.co | none | `Access-Control-Allow-Origin: https://jameschang.co` · `max-age=3600, s-maxage=86400` |
| `/rss.xml` | `rss.xml.js` | RSS feed | none | — |

<!-- Prompt-to-self: populate the response shapes from the actual code. Don't guess -->
<!-- field names — open the .json.ts file and read what it returns. -->

**⚠️ "Auth: none" is literal.** Four of these exist to serve the admin, but they are
publicly fetchable by anyone who knows the URL. `posts-admin.json` is marked `noindex`,
which keeps it out of search results — that is obscurity, not access control. Whether
that matters depends on whether any of them leak anything non-public.

<!-- TODO(james): audit what /posts-admin.json, /data-quality.json, /tests-admin.json -->
<!-- and /stats.json actually expose. Draft post titles? Slugs of unpublished work? -->
<!-- If yes, that's a real (if low-severity) leak worth a RISK- entry. -->

### Response shapes

<!-- TODO: one subsection per endpoint. Template: -->

#### `/places-hitlist.json`
- **Method:** `GET`
- **Inputs:** none
- **Returns:** <!-- TODO: read places-hitlist.json.ts and fill in -->
- **Consumed by:** jameschang.co (cross-origin), and the Hit List page
- **Breaking-change risk:** **high** — a second codebase depends on this shape. Changing a
  field name here breaks another site with no build-time error.

---

## Outbound: the GitHub Contents API

The admin's write path. Wrapped in `tina/_shared/github-contents.ts` so the handling lives
in one place.

| Operation | Call | Notes |
|---|---|---|
| Read a file | `GET /repos/{owner}/{repo}/contents/{path}` | Returns base64 content + `sha` |
| Write a file | `PUT /repos/{owner}/{repo}/contents/{path}` | Body carries `message`, base64 `content`, `sha`, `branch` |

**Auth:** a personal access token the user pastes in, held in `sessionStorage`, scoped
Contents R+W. Dies when the tab closes.

**Error handling — these are load-bearing:**

| Status | Thrown as | Means |
|---|---|---|
| 401 / 403 | `TokenRejectedError` | Token expired or lacks scope |
| 409 | `ShaConflictError` | Someone else edited it. **Reload and retry — there is no auto-merge.** |
| other | generic `Error` | — |

**Encoding:** must go through `utf8ToBase64` / `base64ToUtf8`, never bare `atob`/`btoa`.
Those are Latin-1 only and corrupt every multi-byte character — and this archive is full
of Chinese venue names. See ADR-001 invariant I1.

---

## Outbound: Google Places API

Called **offline only**, from `scripts/venue-tags/lookup_place_ids_api.py`. Never from the
browser, never at build. The key is not in the deployed site.

See `reference_google_places_api` in project memory, and `docs/operator/api-key-trap.md`
for the "Application restrictions: Websites + empty domain list" trap that silently blocks
server-side calls.
