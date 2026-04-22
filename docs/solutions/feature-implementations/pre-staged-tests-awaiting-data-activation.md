---
title: "Pre-staged tests: writing assertions before the data exists"
date: 2026-04-22
category: feature-implementations
tags:
  - testing
  - playwright
  - e2e
  - dynamic-fixtures
  - content-migration
  - test-patterns
components_affected:
  - tests/e2e/closed-venues.spec.ts
  - src/content/posts/*closed*.md
prs:
  - "#51"
  - "#65"
status: implemented
---

# Pre-staged tests: writing assertions before the data exists

## Overview

A pattern for writing tests against UI behavior that depends on **specific content or data** which may not exist yet at the time the test is authored. Instead of faking data, skipping the test indefinitely, or waiting to write the test until the data lands, you write it **now** with a graceful skip until the data arrives, then the test activates automatically.

This doc walks through the canonical example in this project: `tests/e2e/closed-venues.spec.ts`, staged in [PR #51](https://github.com/thirstypig/thirstypig-blog/pull/51), activated and tuned in [PR #65](https://github.com/thirstypig/thirstypig-blog/pull/65).

## Problem

You want to test a UI feature — say, the "CLOSED" badge and grayscale image treatment for closed restaurants on a food blog. The rendering code exists, but the *data* to trigger it doesn't. Every closed-venue post in the current content is `draft: true`, so no live post surfaces the `isClosed` branch in `PostCard.astro`, `search.astro`, or `RelatedPosts.astro`. The feature is a dead code path.

Three common patterns for handling this — all wrong in different ways:

1. **Write the test hoping data will appear; let it fail.** CI goes red on every run. Future-you writes it off as "known flake" and stops paying attention.
2. **Hardcode fake data in the test.** Now you're testing the fake fixture, not the production system. When real data arrives, the test doesn't notice.
3. **Wait to write the test until the data lands.** Future-you forgets; the feature ships; the code path rots silently.

## Solution

Write the test now with a **dynamic fixture** that fetches real data at test time and **skips gracefully** when the fixture isn't there yet.

### The full pattern

```typescript
// tests/e2e/closed-venues.spec.ts
import { test, expect } from "@playwright/test";

test.describe("closed venue rendering", () => {
  test("search results show CLOSED badge and grayscale thumbnail", async ({ page, request }) => {
    // 1. Fetch live data at test time
    const resp = await request.get("/search.json");
    expect(resp.ok()).toBe(true);
    const posts: Array<{ id: string; title: string; tags?: string[]; heroImage?: string }> =
      await resp.json();

    // 2. Find a qualifying fixture (or fail over cleanly)
    const closedPost = posts.find(p =>
      (p.tags || []).some(t => t.toLowerCase() === "closed") ||
      p.title.toLowerCase().includes("closed")
    );

    // 3. Skip gracefully with a clear, actionable message
    test.skip(
      !closedPost,
      "No closed posts in current /search.json index — skipping",
    );

    // 4. Once data exists, run the real assertions
    await page.goto("/search");
    await page.locator("#search-input").fill(closedPost!.title.slice(0, 30));
    // ... assertions
  });
});
```

### Three key moves

1. **Fetch data at test time** (`page.request.get('/search.json')`) instead of importing a hardcoded fixture. The test follows the real data; the data doesn't have to follow the test.

2. **`test.skip()` with an explicit reason** — not `test.skipIf()` that silently no-ops. The skip message shows up in CI logs so future-you knows *why* it skipped (and *when* to expect activation).

3. **The test becomes real the moment content changes** — no test code updates needed on activation. When we flipped 37 closed posts to `draft: false` in PR #65, the test un-skipped on the next CI run without any test file touch.

## The first-activation iteration

Pre-staged tests have a known failure mode: **the first time they actually run, they may fail on assumptions you didn't test in the pre-staged state.**

Our first activation caught exactly this:

```diff
-  // ASSUMED: every closed post has a heroImage → grayscale class applies
-  const grayscaleImg = resultCard.locator("img.grayscale");
-  await expect(grayscaleImg).toBeVisible();
+  // REALITY: 0 of 37 legacy closed posts have hero images
+  // (2009-2012 WordPress reviews were text-only)
+  const hasHero = Boolean(closedPost.heroImage);
+  if (hasHero) {
+    const grayscaleImg = resultCard.locator("img.grayscale");
+    await expect(grayscaleImg).toBeVisible();
+  }
```

The `grayscale` class is applied conditionally in `search.astro`:
```js
${safeImage ? `<img src="..." class="... ${isClosed ? 'grayscale opacity-75' : ''}" />` : `<div>...TP fallback...</div>`}
```

So `img.grayscale` only exists when `heroImage` is truthy. The pre-staged test assumed a happy-path closed post; the real data had no hero images. **This is fine** — the test caught its own over-assertion on activation, not in production.

**Lesson:** write pre-staged tests to the universal invariants first (the CLOSED badge is always there), then branch on data-conditional invariants (grayscale only when image exists).

## Supporting pattern 1 — Surgical content edits

Activating 37 closed posts required flipping `draft: true` → `draft: false` plus adding a `"closed"` tag on each. The naive approach (`yaml.load` → modify dict → `yaml.dump` back) would have produced ~1,100 lines of cosmetic reformatting noise (single-vs-double quote changes, indent differences, key-order shifts). See [`yaml-round-trip-timestamp-and-utf8-corruption.md`](../build-errors/yaml-round-trip-timestamp-and-utf8-corruption.md) for why YAML parsers disagree on formatting.

Instead, surgical string replacement preserves every file's exact formatting:

```python
import re
from pathlib import Path

for p in sorted(Path('src/content/posts').glob('*closed*.md')):
    content = p.read_text()
    if 'draft: true' not in content:
        continue
    # Flip the flag — only touches that one line
    content = content.replace('draft: true', 'draft: false', 1)
    # Insert tag if not already present
    if not re.search(r'^\s*- closed\s*$', content, re.MULTILINE):
        content = re.sub(r'^(tags:)\n', r'\1\n- closed\n', content, count=1, flags=re.MULTILINE)
    p.write_text(content)
```

Result: 37 files × ~3 lines of actual change = ~90 lines of diff. Reviewer can see exactly what changed.

**Trade-off**: surgical edits are harder for complex transformations (nested restructuring, ordering changes). But for "flip this one field on N files" they're a 12× reduction in diff size. Reach for them when the transformation is field-level, not structure-level.

## Supporting pattern 2 — Duplicate-file detection

The original scope for PR #65 also included drafting a "16-word Xibo stub" that had been flagged as text-only in prior enrichment runs. Digging in revealed **two Xibo posts**:

- `2012-02-25-xibo-shanghai.md` — the 16-word stub, already `draft: true`
- `2012-05-03-xibo-shanghai.md` — a full review, `draft: false`, no hero image

The "decision" was already correctly handled. The lesson: when content state looks weird, check for sibling files before assuming the surface state is wrong.

```bash
# First move when content diagnostics look off:
ls src/content/posts/*<slug-keyword>*.md
```

## Prevention / best practices

### When to pre-stage a test

You're the right audience for this pattern when **any three** of the following are true:

- The feature's rendering code is shipped but dead until content is added
- You don't want to wait weeks for content before codifying the UI contract
- The feature is easy to forget about once merged (no dashboard will surface "these branches never run in production")
- You have a way to query live data at test time (JSON endpoint, API, file on disk)

### The skip message is load-bearing

```typescript
test.skip(!closedPost, "No closed posts in current /search.json index — skipping");
```

vs.

```typescript
test.skip(!closedPost);  // silent
```

The first version surfaces *why* in CI output. The second becomes a mystery when future-you wonders why a test keeps skipping. Always write the reason.

### Invariant-first, conditional-second

When drafting pre-staged assertions:

1. **Universal invariants**: things that must be true for every qualifying fixture. Assert these unconditionally.
2. **Conditional invariants**: things that depend on the fixture's specific shape. Branch on `hasX` before asserting.

Example from this code:

```typescript
// Universal: every closed post's result card has a CLOSED badge
await expect(resultCard.locator("text=Closed")).toBeVisible();

// Conditional: grayscale applies only when a hero image is present
if (closedPost.heroImage) {
  await expect(resultCard.locator("img.grayscale")).toBeVisible();
}
```

### Related signal — check assertion counts after activation

The Phase 2 test dashboard ([`testing-stack-three-tier-cadence.md`](./testing-stack-three-tier-cadence.md)) auto-counts assertions per file. When `closed-venues.spec.ts` went from 1 pre-staged assertion to 1 running assertion (+ conditional branch), the dashboard reflected this automatically. No hand-maintained count to update. Pattern: let build-time introspection keep the dashboard truthful.

## Related solutions

- [Testing stack: three-tier cadence](./testing-stack-three-tier-cadence.md) — documents the overall testing cadence that this pattern plugs into; the pre-staged test was one of the canonical examples in that doc from day one
- [YAML round-trip bugs](../build-errors/yaml-round-trip-timestamp-and-utf8-corruption.md) — explains why `yaml.dump` reformats files and motivates the surgical-edit approach
- [Front-end audit + image pipeline](./front-end-audit-and-image-pipeline.md) — documented the `isClosed` branches as "currently unreachable" after PR #51; this is the doc where those branches came alive
- [Hit List Manager: TinaCMS + GitHub commits](./hitlist-manager-tinacms-github-commits.md) — another dynamic-data-at-request-time pattern

## Follow-ups

- The `test.skip()` → conditional assertions technique could be applied to other data-dependent tests if/when we add features whose rendering depends on specific content (e.g., "recipe" schema if we ever build one — would skip until at least one recipe post exists).
- Consider extracting a helper: `findQualifyingPost(predicate, skipReason)` that wraps the fetch + find + skip dance into one line. Deferred until we have a second use case to confirm the abstraction.
