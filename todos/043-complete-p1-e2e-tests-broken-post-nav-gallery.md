---
status: complete
priority: p1
issue_id: "043"
tags:
  - testing
  - e2e
  - playwright
  - nav
  - gallery
  - code-review
dependencies: []
---

# E2E Tests Broken After Layout + Nav Refactor (PRs #118–123)

## Problem Statement

Four categories of Playwright assertions are now wrong after the layout and nav restructure. The CI suite will fail on these tests on every PR until fixed. The tests were never updated to match the renamed CSS class, changed `loading` attribute, moved nav items, and relocated gallery images.

## Findings

**1. `.hero-container` selector dead — `post-page.spec.ts` lines 39-43, 60-61, 67-68**

`BlogPost.astro` renamed `.hero-container` → `.post-image-wrap` (PR #121). Tests still look for `.hero-container`. The `heroPicture` locator finds nothing — assertions time out.

**2. Hero `loading="lazy"` assertion wrong — `post-page.spec.ts` line 51**

`BlogPost.astro` line 113 now emits `loading="eager"` (correct for LCP). Test asserts `loading="lazy"`. This assertion was correct before PR #120; it is now wrong.

**3. `nav-tags`, `nav-about`, `nav-hitlist`, `nav-cuisine` testIds invisible in desktop viewport**

After PR #123, these items moved from `navItems` → `mobileExtras`. The desktop `<div class="hidden md:flex">` only renders `navItems` (Posts + Cities). Mobile menu renders them with a `-mobile` suffix. Playwright's default viewport is 1280×720 (desktop). These testIds are in the DOM but CSS-hidden (`display:none`) — `click()` and `toBeVisible()` fail.

Affected files:
- `tests/e2e/tag-cloud.spec.ts` lines 6-9 — `nav-tags`
- `tests/e2e/static-pages.spec.ts` lines 18-21 — `nav-about`
- `tests/e2e/hitlist.spec.ts` lines 82-84 — `nav-hitlist`

**4. Body-images locator finds nothing — `post-page.spec.ts` lines 54-74**

The fixture post (Stiles Switch or similar) is now caption-first with 0 inline `![...]()` markdown images. All gallery images render in `BlogPost.astro`'s gallery loop outside `.prose`. The `article .prose picture` locator returns 0 elements. `expect(count).toBeGreaterThan(1)` fails.

## Proposed Solutions

### Option A: Update selectors to match the new DOM (Recommended)

1. `post-page.spec.ts`: Replace `.hero-container` → `.post-image-wrap:first-of-type` (to distinguish hero from gallery wrappers); update `loading` assertion to `"eager"`; update gallery locator to `.post-image-wrap picture` (outside prose)
2. `tag-cloud.spec.ts`, `static-pages.spec.ts`, `hitlist.spec.ts`: Either (a) assert on footer links instead of nav bar, or (b) open the mobile menu before clicking, or (c) skip the "nav link" click and just assert the page loads correctly from direct URL

The footer nav does not use `data-testid`, so option (c) is lowest-risk — navigate directly to the page by URL, assert `aria-current` on the footer link.

- **Effort:** Small (30 min)
- **Risk:** Low

### Option B: Add `data-testid` to footer nav links for desktop-nav-absent items

Add `data-testid="footer-nav-tags"` etc. to footer nav links. Tests assert on the footer instead of the header nav.

- **Effort:** Small
- **Risk:** Low — non-breaking addition

## Recommended Action

Option A: fix all four categories in a single PR. Start with `post-page.spec.ts` since it has 3 distinct failures.

## Technical Details

**Affected files:**
- `tests/e2e/post-page.spec.ts` (hero selector, loading attr, body-images locator)
- `tests/e2e/tag-cloud.spec.ts` (nav-tags desktop)
- `tests/e2e/static-pages.spec.ts` (nav-about desktop)
- `tests/e2e/hitlist.spec.ts` (nav-hitlist desktop)

**Root cause:** PRs #120-123 changed DOM structure and nav layout but did not update corresponding E2E tests.

## Acceptance Criteria

- [ ] `npm run test:e2e` passes locally on all 3 browsers (Chrome, Firefox, WebKit)
- [ ] Hero image assertions target `.post-image-wrap:first-of-type` and assert `loading="eager"`
- [ ] Nav tests for non-desktop items navigate via URL or use footer/mobile selectors
- [ ] Gallery image assertions target the gallery loop wrappers outside `.prose`
- [ ] No test timeouts on CI

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by agent-native-reviewer during code review | Pre-commit doesn't run E2E; this drift was invisible until the review |

## Resources

- `tests/e2e/post-page.spec.ts`
- `tests/e2e/tag-cloud.spec.ts`
- `tests/e2e/static-pages.spec.ts`
- `tests/e2e/hitlist.spec.ts`
- Solution doc: `docs/solutions/test-failures/e2e-coupled-to-ui-text-after-rename.md`
