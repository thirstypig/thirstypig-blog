---
status: pending
priority: p2
issue_id: "023"
tags:
  - code-review
  - architecture
  - admin-docs
  - drift
dependencies: []
---

# StatusSection counters are hard-coded — go stale within one batch

## Problem Statement

`tina/AdminDocs.tsx` ships with five hard-coded pipeline counters in
`StatusSection` (`365 venues curated`, `336 with FID hex`, `320 chip JSONs
published`, `439 posts displaying tags`, `552 single-post candidates`) plus
the changelog deltas (`65 → 336`, `64 → 320`, `123 → 439`). These numbers
were accurate at commit time and will drift the next time a batch ships —
which the subtitle even admits ("Numbers drift as batches ship — refresh
from `scripts/venue-tags/venues.yaml` and `public/venue-tags/` for live
counts").

This is the silent-fail pattern flagged in `feedback_silent_fail_class.md`:
the screen renders fine, the human believes it, the data is wrong. Within
two batches the operator stops trusting the panel, and the cost of every
visit is "compare against `ls public/venue-tags/ | wc -l` and discount
mentally."

The Pipeline Status section is the one part of this screen that genuinely
belongs in an admin UI, and it's the part most poorly served by hardcoded
JSX. `TestingDashboard.tsx` already establishes the pattern: build-time
JSON endpoint, screen fetches and renders.

## Findings

- **Drift surface:** `tina/AdminDocs.tsx:428,432,436,440,447` (status
  counters) and `:511-514` (changelog deltas).
- **Live sources already exist:** `scripts/venue-tags/venues.yaml` (curated
  + FID rows), `public/venue-tags/*.json` (published JSONs — `ls | wc -l`),
  post frontmatter `placeId` field count (`grep -lE '^placeId:'
  src/content/posts/ | wc -l`).
- **House pattern for live admin counts:** `src/pages/tests-admin.json.ts`
  (build-time JSON endpoint) feeding `tina/TestingDashboard.tsx`.
- **Memory `feedback_silent_fail_class.md`:** "Pipeline steps that
  succeed-as-no-op need explicit count assertions; lived through 98-venue
  scrape that produced zero artifacts." Same class — UI succeeds-as-stale.
- Three reviewers (simplicity, architecture, agent-native) converged on
  this finding.

## Proposed Solutions

### Option A — Delete StatusSection, link to source files

Trim `tina/AdminDocs.tsx:415-498` to a one-paragraph stub: "Live counts
live in `venues.yaml` and `public/venue-tags/`. Run `ls public/venue-tags/
| wc -l` for the published count." Drop the four `<div style={s.stat}>`
blocks entirely.

- **Pros:** ~85 LOC deleted; zero drift surface; no new build code; honest
  about what the screen is (a doc panel, not a dashboard).
- **Cons:** loses the at-a-glance feel; operator runs a shell command
  instead of glancing at a number.
- **Effort:** Small (15 min)
- **Risk:** None

### Option B — Build-time JSON endpoint, fetched at mount

Create `src/pages/admin-docs.json.ts` that exports counts at build time:

```ts
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  const venues = await fs.readFile("scripts/venue-tags/venues.yaml", "utf8");
  const venuesCount = (venues.match(/^- /gm) || []).length;
  const fidCount = (venues.match(/place_id: 0x/gm) || []).length;
  const publishedCount = (await fs.readdir("public/venue-tags"))
    .filter(f => f.endsWith(".json")).length;
  const posts = await fs.readdir("src/content/posts");
  // ... count posts with placeId frontmatter
  return new Response(JSON.stringify({
    venuesCount, fidCount, publishedCount, taggedPostsCount,
  }));
}
```

`AdminDocs.tsx` then `useEffect`-fetches `/admin-docs.json` and renders.
`StatusSection` becomes data-driven; no drift possible.

- **Pros:** counts always match reality; matches the established
  TestingDashboard pattern; agent-native (build script outputs are
  agent-readable).
- **Cons:** ~60 LOC of new build code; another build-time JSON endpoint to
  maintain; turns a static screen into a fetch-on-mount one.
- **Effort:** Medium (1–2 hours)
- **Risk:** Low (matches an existing, working pattern)

### Option C — Accept staleness, add a timestamp + "snapshot" framing

Keep the numbers, but render a `Snapshot taken 2026-04-30. Re-run
`scripts/.../count_status.sh` and update this file to refresh.` warning.
Reframe the screen as a one-shot snapshot.

- **Pros:** zero new code; explicit about staleness.
- **Cons:** doesn't actually solve the trust problem; just lowers
  expectations. The screen will still go stale; the warning will still get
  ignored.
- **Effort:** None
- **Risk:** None

## Recommended Action

(Filled during triage. Option A is cheapest and removes the drift surface
entirely. Option B is right if "admin status at a glance" is genuinely
valuable — but the operator is one person who already runs the CLI.)

## Technical Details

- **Affected files (Option A):**
  - `tina/AdminDocs.tsx` — delete StatusSection lines 415-498; remove
    references in `SECTIONS`/`SECTION_RENDERERS`; remove unused style keys
    `stat`/`statNum`/`statLabel` (lines 168-186).
- **Affected files (Option B):**
  - `tina/AdminDocs.tsx` — convert StatusSection to fetch-on-mount;
    handle loading/error.
  - `src/pages/admin-docs.json.ts` — new build-time endpoint.
  - `astro.config.mjs` (verify static generation includes this route).

## Acceptance Criteria

- [ ] No hard-coded venue/post counts in `tina/AdminDocs.tsx`
- [ ] (If Option B) `/admin-docs.json` returns current counts at build time
- [ ] Subtitle no longer needs the "refresh from venues.yaml" disclaimer

## Work Log

(Empty)

## Resources

- `tina/AdminDocs.tsx:415-498` (StatusSection)
- `tina/AdminDocs.tsx:505-554` (changelog deltas — same drift class)
- `tina/TestingDashboard.tsx` (build-time-data pattern to mirror)
- `src/pages/tests-admin.json.ts` (existing build-time JSON endpoint)
- `feedback_silent_fail_class.md` (memory)
- Convergent finding from simplicity-reviewer, architecture-strategist,
  agent-native-reviewer
