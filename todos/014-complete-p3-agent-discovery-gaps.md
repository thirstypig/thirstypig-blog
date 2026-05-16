---
status: pending
priority: p3
issue_id: "014"
tags:
  - code-review
  - agent-native
  - discoverability
  - documentation
dependencies: []
---

# Agent-native gaps: no /regions.json endpoint + IG-watcher trigger undocumented

## Problem Statement

Two small agent-discoverability gaps from this session's work:

**1. Region landing pages (38 of them) have no JSON companion endpoint.** Every other listing surface in this repo ships a `.json.ts` for programmatic enumeration — search, map, hitlist, posts, stats, tests-admin. But the new `/regions/[region]/` pages only exist as build output. An agent wanting to enumerate all regions and their post counts has to either scrape `dist/regions/` after a build, or read the post collection and re-derive the slugs (duplicating logic).

**2. IG-watcher trigger convention isn't documented.** `gh release create` from any context (not just the local Mac) fires `instagram-sync.yml`. So agent-parity exists for "trigger an IG sync" — but it's tribal knowledge buried in `.github/workflows/instagram-sync.yml`. CLAUDE.md should name the convention so future agents discover it without spelunking.

## Findings

- `src/pages/` — has `search.json.ts`, `map.json.ts`, `places-hitlist.json.ts`, `posts-admin.json.ts`, `tests-admin.json.ts`, `stats.json.ts`, but no `regions.json.ts`
- `CLAUDE.md` — does not mention the release-tag → workflow trigger pattern
- Discovered by agent-native-reviewer during /ce:review

## Proposed Solutions

### Option A: Add `src/pages/regions.json.ts` + one-liner in CLAUDE.md

`regions.json.ts`:
```ts
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { slugify } from "../utils";
import { aggregateRegions } from "../utils/regions";

export const GET: APIRoute = async () => {
    const posts = (await getCollection("posts")).filter(p => !p.data.draft);
    const counts = new Map<string, number>();
    for (const p of posts) {
        if (p.data.region) counts.set(p.data.region, (counts.get(p.data.region) || 0) + 1);
    }
    const data = [...counts.entries()].map(([region, postCount]) => ({
        slug: slugify(region),
        name: region,
        postCount,
        url: `/regions/${slugify(region)}/`,
    }));
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
};
```

CLAUDE.md addition under "Quick orientation":
> **Trigger an IG sync programmatically:** create a release tagged `ig-*` with the IG export ZIP attached. The `instagram-sync.yml` workflow fires on any release with that tag prefix.

- Pros: closes both gaps; tiny code surface
- Cons: none
- Effort: Small (~15 min)
- Risk: None

## Recommended Action

_To be filled during triage. Option A is recommended._

## Technical Details

Affected files:
- New: `src/pages/regions.json.ts`
- `CLAUDE.md`
- `src/pages/tests-admin.json.ts` (add metadata entry for the new endpoint to satisfy that file's drift invariant)

## Acceptance Criteria

- [ ] `curl https://thirstypig.com/regions.json` returns array of `{slug, name, postCount, url}`
- [ ] CLAUDE.md mentions the release-tag → workflow trigger
- [ ] `/admin → Testing` dashboard doesn't tag the new endpoint as "(undocumented)"

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Identified during /ce:review | Agent-native parity is a discipline; new surfaces should ship with their JSON endpoint by default. |

## Resources

- `src/pages/places-hitlist.json.ts` (reference for endpoint shape)
- `src/utils/regions.ts`
- `CLAUDE.md`
