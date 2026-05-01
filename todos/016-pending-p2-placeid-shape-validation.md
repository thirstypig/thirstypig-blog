---
status: pending
priority: p2
issue_id: "016"
tags:
  - code-review
  - security
  - venue-tags
dependencies: []
---

# Validate `placeId` shape at the schema layer

## Problem Statement

The post schema declares `placeId: z.string().optional()` with no regex or length cap (`src/content.config.ts:24`). The values currently in the corpus are all clean `0x[0-9a-f]+:0x[0-9a-f]+` hex pairs from our scraper, but nothing enforces that.

Two failure modes if a malicious value lands in frontmatter:

1. **Build-time path traversal** — `src/components/VenueTags.astro:22` does `path.join(process.cwd(), 'public', 'venue-tags', \`${placeId}.json\`)`. Node's `path.join` does not block `..`. A frontmatter `placeId: "../../../etc/passwd"` would let `fs.readFileSync` read outside `public/venue-tags`.
2. **Stored XSS via attribute** — `VenueTags.astro:45` renders `href={\`/venue-tags/${placeId}.json\`}`. Astro auto-escapes `${placeId}` in attribute context, so injecting `"><script>` would not execute. Verified safe **as long as the render uses Astro template syntax** (it does today).

Real-world risk is low — exploitation requires write access to the repo. But the fix is one line and locks the threat model down.

## Findings

- **Schema location:** `src/content.config.ts:24` — `placeId: z.string().optional()`
- **Consumer 1:** `VenueTags.astro:22` builds a file path from `placeId`
- **Consumer 2:** `VenueTags.astro:45` builds an `href` from `placeId`
- **Format we want:** `^0x[0-9a-f]+:0x[0-9a-f]+$` (Google FID hex pair)

## Proposed Solutions

### Option A — Zod regex on the schema

```ts
placeId: z.string().regex(/^0x[0-9a-f]+:0x[0-9a-f]+$/).optional(),
```

- **Pros:** shuts the path-traversal door at the schema layer; gives every downstream consumer a typed, narrow input; rejects bad values at build time with a clear error
- **Cons:** if Google ever changes their FID format the build breaks (extremely unlikely)
- **Effort:** Small
- **Risk:** Low

### Option B — Runtime validation in VenueTags.astro

Validate `placeId` shape inside the component before using it.

- **Pros:** localized to consumer
- **Cons:** has to be repeated on every consumer (search.json.ts, TagGraph.astro, etc.); not enforced at content-collection-load time
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

(Filled during triage — Option A.)

## Technical Details

- **Affected files:** `src/content.config.ts`
- **Test plan:** drop a bogus placeId into a draft post, run typecheck — should error.

## Acceptance Criteria

- [ ] Frontmatter `placeId: "../etc/passwd"` fails the build
- [ ] Frontmatter `placeId: "0x123:0x456"` passes
- [ ] No regression on the 117 currently-tagged posts

## Work Log

(Empty)

## Resources

- `src/content.config.ts`
- `src/components/VenueTags.astro:22,45`
- Zod docs on `.regex()`
