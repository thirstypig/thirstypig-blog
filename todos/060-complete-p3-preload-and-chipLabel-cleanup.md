---
status: complete
priority: p3
issue_id: "060"
tags:
  - testing
  - cleanup
  - preload
  - code-review
dependencies: ["059"]
---

# P3 Cleanup Bundle: Preload Coverage + chipLabel + `?? undefined`

## Problem Statement

Three small items from the review that don't warrant individual todos:

1. **No E2E test verifies the preload `<link>` exists** — if the preload is accidentally dropped (wrong conditional, prop rename), no test fails. The preload is the entire point of the `heroPreloadHref` prop.

2. **`chipLabel` dead variable in tag-cloud.spec.ts** — declared with a comment promising an assertion that never materializes, making the test weaker than intended.

3. **`?? undefined` trailing operand is redundant** in `BlogPost.astro`.

## Findings

**Preload coverage gap:**
Zero tests in `tests/` reference `preload` or `rel="preload"`. The regression path: a refactor changes the conditional, the preload is silently suppressed, and LCP degrades on all post pages with no CI signal.

**Dead variable:**
```ts
// tag-cloud.spec.ts
const chipLabel = await firstChip.textContent();  // declared
// ... chipLabel never used in any assertion ...
await expect(page).toHaveURL(/\/search\/\?q=/);   // only checks URL shape
```
The comment says "so we can assert the search query" — the assertion was never written. The test passes even if the chip navigates to `/search/?q=wrong-tag`.

**Redundant `?? undefined`:**
```astro
heroPreloadHref={heroInfo?.webp ?? heroImage ?? undefined}
```
If this todo ships after todo #059 (which changes this to just `heroInfo?.webp`), this is moot. If shipped before, trim to `heroInfo?.webp ?? heroImage`.

## Proposed Solutions

### 1. Add preload assertion to post-page.spec.ts

```ts
test("hero image has a <link rel=preload> in <head>", async ({ page }) => {
  await page.goto(POST_URL);
  const preload = page.locator('link[rel="preload"][as="image"]');
  await expect(preload).toHaveCount(1);
  // href or imagesrcset should reference the hero image
  const href = await preload.getAttribute('href') ?? await preload.getAttribute('imagesrcset');
  expect(href).toMatch(/\.(webp|jpg|jpeg|png)/);
});
```

Catches: prop accidentally removed, conditional wrong, attribute name changed.

### 2. Use chipLabel in assertion

```ts
const chipLabel = (await firstChip.textContent())!.trim();
await firstChip.click();
await expect(page).toHaveURL(/\/search\/\?q=/);
await expect(page).toHaveURL(new RegExp(encodeURIComponent(chipLabel)));
```

Verifies the specific tag is in the query, not just any search URL.

### 3. Drop `?? undefined`

```astro
heroPreloadHref={heroInfo?.webp ?? heroImage}
```

One less token, same behavior.

## Recommended Action

Do all three in one commit. Dependency: wait for #059 before shipping item 3 (the heroPreloadHref line will likely change anyway).

## Acceptance Criteria

- [ ] `post-page.spec.ts` has a test that finds `link[rel="preload"][as="image"]` and asserts its `href` or `imagesrcset` references an image file
- [ ] `tag-cloud.spec.ts` `chipLabel` is either asserted against or removed
- [ ] `?? undefined` trailing operand removed from BlogPost.astro

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by code-simplicity-reviewer and agent-native-reviewer | Dead variables in tests erode confidence that the test actually covers the feature |
