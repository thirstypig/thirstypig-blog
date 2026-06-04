---
status: pending
priority: p2
issue_id: "040"
tags:
  - ads
  - ux
  - instagram
  - code-review
dependencies: []
---

# In-article ad lands in dead zone between caption and hero on most IG posts

## Problem Statement

`<AdInArticle />` is placed in `BlogPost.astro` between the prose `<slot />` (post content) and the hero image block. On long Wayback posts with multi-paragraph text this is a genuine mid-prose gap. But 1,649 of 2,120+ posts are IG-sourced with short one-to-three-sentence captions — for those, the layout is: caption → **ad** → hero image. The hero image is the main visual content; the ad fires in a narrow gap between the caption and the most-viewed element. Expected fill rate for this placement is low (AdSense's in-article format is optimized for inline paragraph breaks, not image-before/after transitions). The reserved 200px (or 280px after #038 is fixed) is paid on every post load unconditionally.

## Findings

- `BlogPost.astro` layout order: top ad → categories/title/date → location card → venue tags → **article content (slot)** → **AdInArticle** → hero image → image gallery → bottom ad
- 1,649 / 2,120+ posts are Instagram-sourced (short captions = thin `<slot />` content)
- For IG posts: the in-article ad has ~1–3 sentences of content above it; hero image is the primary visual
- Astro's `<slot />` renders wholesale — cannot inject mid-paragraph from the layout
- Identified by: architecture-strategist (P3), performance-oracle (P1 for fill rate)

## Proposed Solutions

### Option A: Move unit to end-of-content (before bottom AdSlot)

In `BlogPost.astro`, move `<AdInArticle />` from line 99 (after prose) to just before `<AdSlot slot={adSlotBottom} />`:

```
... image gallery ...
<AdInArticle />
<AdSlot slot={adSlotBottom} />
```

- **Pros:** Clearer "end-of-post" placement; consistent story for all post types; likely similar fill rate to bottom slot but differentiated format
- **Cons:** Effectively a second bottom unit, not truly "in-article"
- **Effort:** Small (move 1 line)
- **Risk:** Low

### Option B: Implement rehype plugin for mid-prose injection (Recommended for Wayback posts)

Add an Astro rehype plugin that injects the `<ins>` tag after the nth paragraph of the post body (e.g., after paragraph 3). This is the true mid-prose in-article position.

- **Pros:** Correct placement for all long-form posts; genuine in-article UX
- **Cons:** Complex (rehype plugin, need to handle posts with fewer than n paragraphs); won't help IG posts which have 1–2 short paragraphs anyway
- **Effort:** Large
- **Risk:** Medium (could break existing content rendering)

### Option C: Keep current placement, accept low fill on IG posts

AdSense's optimization will route the fluid unit to placements where it gets clicks; fill rate self-corrects over time.

- **Pros:** No change needed
- **Cons:** Wasted reserved space on ~78% of posts; misleading "in-article" label
- **Effort:** None
- **Risk:** None

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected file:** `src/layouts/BlogPost.astro` line 99
**Affected posts:** ~1,649 IG-sourced posts (short captions)

## Acceptance Criteria

- [ ] Decision made: move, inject mid-prose, or accept current placement
- [ ] If moved: `<AdInArticle />` in new position, comment updated
- [ ] If rehype: plugin works on posts with < 3 paragraphs (graceful fallback)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-04 | Identified in PR #116 review | IG posts are ~78% of content; fluid in-article format expects paragraph context |

## Resources

- PR #116: feat(ads): consent-gated in-article AdSense unit
- `src/layouts/BlogPost.astro`
- Astro rehype plugins: https://docs.astro.build/en/guides/markdown-content/#markdown-plugins
