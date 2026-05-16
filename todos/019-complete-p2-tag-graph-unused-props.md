---
status: pending
priority: p2
issue_id: "019"
tags:
  - code-review
  - simplification
  - venue-tags
dependencies: []
---

# `<TagGraph>` props are mostly unused — simplify the API

## Problem Statement

`src/components/TagGraph.astro:5-22` declares three props (`aspectRatio`, `minHeight`, `caption`) with JSDoc and TypeScript interfaces. Only two callers exist:

- `src/pages/tags/graph.astro:20`: `<TagGraph />` (all defaults)
- `src/pages/map.astro:18`: `<TagGraph aspectRatio="5 / 2" minHeight="320px" caption="" />`

`caption` only has two states (default string vs empty); `minHeight` is overridden in one place. The props were added to support shapes that turned out to be one-off configurations.

Textbook YAGNI — API designed for hypothetical reuse that didn't materialize.

## Findings

- **Estimated LOC reduction:** ~15 lines (interface + JSDoc + defaults destructuring + conditional caption render at line 99)
- **Risk of future breakage:** low — only 2 callers to update

## Proposed Solutions

### Option A — Inline the second config

Keep the component default config (16/9, no min-height, default caption). For `/map`, copy the canvas + script inline rather than passing props.

- **Pros:** kills the prop interface; very simple
- **Cons:** duplicates ~15 lines of canvas markup at /map
- **Effort:** Small
- **Risk:** None

### Option B — Hardcode a "context" enum prop

```astro
<TagGraph context="banner" />  // for /map
<TagGraph context="full" />     // for /tags/graph
```

Internally map to ratio + min-height. Reduces 3 props to 1.

- **Pros:** still abstracted; clearer intent than free-form CSS values
- **Cons:** still adds API surface for 2 callers
- **Effort:** Small
- **Risk:** None

### Option C — Drop only `caption`; keep `aspectRatio` + `minHeight`

The two-state caption is the most clearly-overengineered prop. Aspect ratio has a real reason to vary.

- **Pros:** minimal change; preserves the visual flexibility
- **Cons:** still has the unused-props smell on `caption`
- **Effort:** Tiny
- **Risk:** None

## Recommended Action

(Filled during triage — Option C is the lowest-friction.)

## Technical Details

- **Affected files:** `src/components/TagGraph.astro`, `src/pages/tags/graph.astro`, `src/pages/map.astro`

## Acceptance Criteria

- [ ] Both viz pages render unchanged
- [ ] Component prop interface has fewer fields
- [ ] Typecheck passes

## Work Log

(Empty)

## Resources

- `src/components/TagGraph.astro:5-22`
- `src/pages/tags/graph.astro:20`
- `src/pages/map.astro:18`
