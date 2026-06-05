---
status: complete
priority: p1
issue_id: "044"
tags:
  - ads
  - astro
  - adsense
  - code-review
dependencies: []
---

# `slot` Prop Name Conflicts with Astro Reserved Attribute — Ads May Never Render

## Problem Statement

`AdSlot.astro` and `AdInArticle.astro` both declare a prop named `slot`. In Astro's component model, `slot` is a reserved attribute for named slot projection — it is intercepted by the framework and is NOT forwarded to `Astro.props`. The component receives `undefined` for `slot` always, `enabled` is always `false`, and no ad unit ever renders.

This would explain why ads appear not to be serving (AdSense account is also still in review, so there's no external confirmation signal yet).

## Findings

In `BlogPost.astro`:
```astro
<AdSlot slot={adSlotTop} />
<AdSlot slot={adSlotBottom} />
<AdInArticle slot={adSlotInArticle} />
```

In `AdSlot.astro`:
```astro
interface Props {
  slot: string | undefined;  // ← `slot` is Astro-reserved, never arrives here
}
const { slot } = Astro.props;
const enabled = Boolean(adClient && slot);
```

`Astro.props` will be `{}` — the `slot` attr is consumed by the Astro runtime as a slot-projection instruction, not passed as a prop. `enabled` is always `false`.

**Verification:** Add `console.log(Astro.props)` inside `AdSlot.astro` during `astro dev` on a post page. You will see `{}`.

## Proposed Solutions

### Option A: Rename prop to `slotId` (Recommended)

In `AdSlot.astro`:
```astro
interface Props {
  slotId: string | undefined;
}
const { slotId } = Astro.props;
const enabled = Boolean(adClient && slotId);
// ... data-ad-slot={slotId}
```

In `AdInArticle.astro`:
```astro
interface Props {
  slotId?: string;
}
const { slotId } = Astro.props;
```

In `BlogPost.astro`:
```astro
<AdSlot slotId={adSlotTop} />
<AdSlot slotId={adSlotBottom} />
<AdInArticle slotId={adSlotInArticle} />
```

- **Effort:** Small (5 min — rename in 3 files)
- **Risk:** Low

### Option B: Verify first, then fix

Run `astro dev`, open a post page, check browser console for ad-related network requests. If no `/googleads` requests fire, confirm the `Astro.props` is empty via console.log. Then apply Option A.

## Recommended Action

Verify first (5 min), then apply the rename. Given AdSense is still in review, the rename is safe — it won't cause ads to fire unexpectedly since Google's review gate is a separate barrier.

## Technical Details

**Affected files:**
- `src/components/AdSlot.astro` — rename `slot` → `slotId` in interface + destructure + `data-ad-slot`
- `src/components/AdInArticle.astro` — rename `slot` → `slotId` in interface + destructure + `data-ad-slot`
- `src/layouts/BlogPost.astro` — update 3 call sites

## Acceptance Criteria

- [ ] `console.log(Astro.props)` inside `AdSlot.astro` shows `{ slotId: "..." }` on a post page
- [ ] `enabled` is `true` when `PUBLIC_ADSENSE_SLOT_TOP` env var is set
- [ ] Ad `<ins>` element renders in the DOM (regardless of Google review status)
- [ ] No regressions in existing ad-related E2E tests (if any)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by kieran-typescript-reviewer during code review | Astro reserves `slot` as a framework attribute; it cannot be used as a component prop name |

## Resources

- `src/components/AdSlot.astro`
- `src/components/AdInArticle.astro`
- `src/layouts/BlogPost.astro`
- Astro docs: Named Slots — https://docs.astro.build/en/basics/astro-components/#named-slots
