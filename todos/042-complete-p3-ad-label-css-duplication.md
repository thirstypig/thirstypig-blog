---
status: pending
priority: p3
issue_id: "042"
tags:
  - ads
  - css
  - simplification
  - code-review
dependencies: []
---

# .ad-label CSS duplicated across AdSlot and AdInArticle

## Problem Statement

`AdSlot.astro` and `AdInArticle.astro` both define `.ad-label` in their scoped `<style>` blocks with nearly identical rules. Astro scopes these so there's no cascade collision, but both rule sets ship to every post page. More practically, if the label style ever needs a global update, it must be changed in two places. The two definitions have also already drifted: `AdSlot` has no `text-align` on `.ad-label`; `AdInArticle` adds `text-align: center`.

Additionally, the wrapper classes (`.ad-slot` and `.ad-inarticle`) share `display: block; margin: 2rem auto` — two more duplicated declarations.

## Findings

`AdSlot.astro`:
```css
.ad-label {
    display: block;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-stone, #78716c);
    margin-bottom: 0.25rem;
}
```

`AdInArticle.astro`:
```css
.ad-label {
    display: block;
    text-align: center;   /* ← diverged */
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-stone, #78716c);
    margin-bottom: 0.25rem;
}
```

- Identified by: code-simplicity-reviewer (P1), architecture-strategist (P2)

## Proposed Solutions

### Option A: Extract shared styles to src/styles/ads.css (Recommended)

1. Create `src/styles/ads.css` with shared `.ad-label` and common wrapper rules
2. Import in both components: `import '../styles/ads.css';`
3. Keep format-specific rules (min-height, text-align differences) scoped per component

- **Pros:** Single source of truth; global updates in one place
- **Cons:** Adds a shared CSS file; Astro won't scope global imports (expected behavior)
- **Effort:** Small
- **Risk:** Low

### Option B: Leave as-is

Accept scoped duplication as a Astro component isolation tradeoff.

- **Pros:** No change; components are self-contained
- **Cons:** Will drift further over time
- **Effort:** None
- **Risk:** None (cosmetic impact only)

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**
- `src/components/AdSlot.astro` (lines 35–46)
- `src/components/AdInArticle.astro` (lines 40–48)

## Acceptance Criteria

- [ ] `.ad-label` styles defined in one place
- [ ] Both ad components render the label identically

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-04 | Identified in PR #116 review | Already drifted on text-align; 3 ad components = manageable but worth centralizing |

## Resources

- PR #116: feat(ads): consent-gated in-article AdSense unit
