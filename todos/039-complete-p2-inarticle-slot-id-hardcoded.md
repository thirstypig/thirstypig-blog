---
status: pending
priority: p2
issue_id: "039"
tags:
  - ads
  - configuration
  - env-vars
  - code-review
dependencies: []
---

# In-article AdSense slot ID is hardcoded; top/bottom slots use env vars

## Problem Statement

`AdInArticle.astro` hardcodes the slot ID as `'7855463968'` in the component source. The top and bottom ad slots use `PUBLIC_ADSENSE_SLOT_TOP` / `PUBLIC_ADSENSE_SLOT_BOTTOM` env vars, so they can be rotated, disabled per environment, or revoked via a Vercel env-var update — no code deploy needed. The in-article slot has no such escape hatch. If AdSense policy enforcement ever requires fast slot removal, the in-article unit needs a ~10-minute image-heavy deploy instead of a 1-minute env var update.

## Findings

- `AdInArticle.astro` line 14: `const slot = '7855463968'; // in-article (fluid) ad unit`
- `BlogPost.astro` lines 36–37: `const adSlotTop = import.meta.env.PUBLIC_ADSENSE_SLOT_TOP;` / `adSlotBottom`
- Pattern mismatch flagged by: security-sentinel (P3), architecture-strategist (P2), code-simplicity-reviewer (P2), agent-native-reviewer (P3)
- Slot IDs are not secrets, so no security risk — this is an operational consistency issue

## Proposed Solutions

### Option A: Add PUBLIC_ADSENSE_SLOT_INARTICLE env var (Recommended)

1. Add to `.env`: `PUBLIC_ADSENSE_SLOT_INARTICLE=7855463968`
2. Add to Vercel project env vars (production + preview)
3. In `BlogPost.astro`, read it the same way as top/bottom: `const adSlotInArticle = import.meta.env.PUBLIC_ADSENSE_SLOT_INARTICLE;`
4. Pass as prop to `<AdInArticle slot={adSlotInArticle} />`
5. In `AdInArticle.astro`, accept `slot` as a prop (matching `AdSlot.astro`'s interface) or make it a named prop

- **Pros:** Consistent with existing pattern; enables fast disable via Vercel env; matches how the other 2 slots work
- **Cons:** Minor: adds a 4th env var
- **Effort:** Small (15 minutes)
- **Risk:** Very low

### Option B: Leave hardcoded

Accept the inconsistency; in-article units are typically a fixed placement and the slot ID rarely changes.

- **Pros:** No change needed
- **Cons:** Operational asymmetry; in-article slot can't be disabled without a code deploy
- **Effort:** None
- **Risk:** Operational risk if fast removal is ever needed

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**
- `src/components/AdInArticle.astro` line 14
- `src/layouts/BlogPost.astro` lines 36–37 (env var read pattern)
- `.env` (add `PUBLIC_ADSENSE_SLOT_INARTICLE`)
- Vercel dashboard env vars

## Acceptance Criteria

- [ ] In-article slot ID read from `PUBLIC_ADSENSE_SLOT_INARTICLE` env var
- [ ] `.env` file updated with the value
- [ ] Vercel production env var set
- [ ] Behavior unchanged (same slot ID, same rendering)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-04 | Identified in PR #116 review | 4 agents independently flagged the inconsistency; top/bottom slots are env-var driven |

## Resources

- PR #116: feat(ads): consent-gated in-article AdSense unit
- `src/components/AdSlot.astro` — takes `slot` prop from env var via BlogPost.astro
