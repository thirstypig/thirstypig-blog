---
status: complete
priority: p2
issue_id: "055"
tags:
  - testing
  - e2e
  - tag-cloud
  - code-review
dependencies: []
---

# Tag Chip Click Navigation Coverage Removed from E2E Suite

## Problem Statement

`tag-cloud.spec.ts` was updated (PR #127) to remove the click-navigation test (which clicked `nav-tags` and asserted the resulting URL). The replacement navigates directly to `/tags/cloud` and asserts `aria-current` on `nav-tags-mobile`. What's no longer tested: that clicking a tag chip actually navigates to a valid tag URL. If all chip `href` values regressed to `#`, `javascript:void(0)`, or a broken slug pattern, the current suite would not catch it.

## Findings

Current `tag-cloud.spec.ts` covers:
- Direct URL load + aria-current (nav routing)
- ≥5 chips visible (pipeline output sanity)
- First chip's rem > last chip's rem (popularity sort)

**Missing:** click a chip → assert URL matches `/tags/[slug]/` pattern.

Agent-native reviewer: "A broken `href` on all tag chips would pass the current suite."

The nav-tags click test was removed because `nav-tags` moved to the mobile menu (desktop-invisible). That change was correct. But the chip-click coverage was a separate concern from nav-link coverage and was accidentally dropped with it.

## Proposed Solutions

### Option A: Add chip-click navigation assertion (Recommended)

```ts
test("clicking a tag chip navigates to that tag's page", async ({ page }) => {
  await page.goto("/tags/cloud");
  const firstChip = page.locator(".tag-link").first();
  await firstChip.click();
  await expect(page).toHaveURL(/\/tags\/[^/]+\/?$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
```

Simple: click the first chip, assert URL is a tag page, assert there's a heading (page loaded).

- **Effort:** XS (8 lines)
- **Risk:** None

### Option B: Assert all chips have valid href format

```ts
const hrefs = await page.locator(".tag-link").evaluateAll(
  chips => chips.map(c => c.getAttribute("href"))
);
expect(hrefs.every(href => /^\/tags\/[^/]+\/?$/.test(href ?? ""))).toBe(true);
```

Catches broken hrefs without navigation. Faster, covers more chips.

- **Effort:** XS
- **Risk:** None

## Recommended Action

Option A — actual navigation is a higher-fidelity check (confirms routing works, not just that the href string looks right). One test, clear intent.

## Technical Details

**Affected file:** `tests/e2e/tag-cloud.spec.ts`

## Acceptance Criteria

- [ ] A test exists that clicks a tag chip and asserts the resulting URL matches `/tags/[slug]/`
- [ ] The test passes in all 3 Playwright browsers (Chromium, Firefox, WebKit)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by agent-native-reviewer during code review | PR #127 correctly moved nav-tags to mobile selector but accidentally dropped the chip click coverage that was separate concern |
