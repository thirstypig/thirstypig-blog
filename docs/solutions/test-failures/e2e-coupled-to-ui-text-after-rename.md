---
title: "E2E tests coupled to UI text break after a redesign rename"
date: 2026-04-27
category: test-failures
tags:
  - testing
  - playwright
  - e2e
  - ci
  - design-redesign
  - navigation
  - aria-current
  - dev-server
  - astro-dev-toolbar
components_affected:
  - tests/e2e/homepage.spec.ts
  - tests/e2e/archive.spec.ts
  - tests/e2e/categories.spec.ts
  - src/components/Header.astro
  - src/pages/index.astro
prs:
  - "#72"
  - "#79"
status: implemented
severity: medium
---

# E2E tests coupled to UI text break after a redesign rename

## Overview

When a visual redesign renames user-facing text (nav labels, headings, button text), Playwright assertions that match by `toHaveText("Old Label")` or `getByRole("heading", { name: "Old Title" })` break the next time CI runs the E2E job. This is expected coupling — those assertions exist *because* user-visible text matters — but the breakage is invisible locally because pre-commit only runs unit/integration. The first signal is a red CI on the merge commit.

This doc captures the canonical instance from PR #72 (Bold Red Poster homepage redesign) → PR #79 (E2E fix), plus a bonus gotcha about Playwright's `reuseExistingServer` behavior with a stale `astro dev` server.

## Problem

PR #72 redesigned the site's nav and homepage. Three changes that broke E2E:

1. **Renamed nav items** (routes unchanged):
   - `Archive` → `Stories` (still points to `/archive/`)
   - `Categories` → `Cities` (still points to `/categories`)

2. **Removed the "Home" nav link entirely.** The new design's wordmark on the left links to `/`, so there's no nav-list item with `aria-current="page"` on the homepage.

3. **Replaced the homepage hero**:
   - `<h1>The Thirsty Pig</h1>` → `<h1>Eat<br>everything.<br>Twice.</h1>`
   - `<h2>Recent Posts</h2>` → `<h2>Right off the stove</h2>`

The redesign PR shipped, unit + Python + typecheck all passed in pre-commit, but the next CI E2E run failed 4 tests across 3 browsers (12 failures total counting browser × retries):

| Test file:line | Old assertion | What broke |
|---|---|---|
| `homepage.spec.ts:10` | h1 `"The Thirsty Pig"` + h2 `"Recent Posts"` | Both headings renamed |
| `homepage.spec.ts:16` | nav `aria-current` link `"Home"` | Home link no longer exists in nav |
| `archive.spec.ts:41` | nav `aria-current` link `"Archive"` | Renamed to `"Stories"` |
| `categories.spec.ts:31` | nav `aria-current` link `"Categories"` | Renamed to `"Cities"` |

CI run that surfaced this: [25028252786](https://github.com/thirstypig/thirstypig-blog/actions/runs/25028252786).

## Why pre-commit didn't catch it

The repo runs four test tiers (per `docs/testing.md`):

| Tier | Trigger | What runs |
|---|---|---|
| 1 | `.githooks/pre-commit` | unit + Python — **NO E2E** |
| 2 | GitHub Actions on push to `main` | unit + Python + E2E |
| 3 | Nightly cron at 11:00 UTC | E2E against production |
| 4 | Pre-deploy smoke | (skipped — over-engineered for this scale) |

Tier 1 is what the local commit cycle exercises. Tier 2 is the first time E2E runs. So a UI-text rename will pass every pre-commit check and only fail after `git push`.

This is **intentional** — running Playwright on every commit would slow the loop too much for a personal blog. But it means visual redesigns need an explicit pre-merge `npm run test:e2e` step that doesn't exist as a default.

## Solution

Update each broken assertion to match the new text. The fix is mechanical once you know what changed.

### homepage.spec.ts

```typescript
// before
test("renders hero and recent posts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "The Thirsty Pig" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Recent Posts" })).toBeVisible();
});

test("main nav has aria-current on the active link", async ({ page }) => {
  await page.goto("/");
  const homeLinks = page.locator('nav[aria-label="Main navigation"] a[aria-current="page"]');
  await expect(homeLinks.first()).toHaveText("Home");
});

// after
test("renders Bold Red Poster hero and the Right off the stove section", async ({ page }) => {
  await page.goto("/");
  // <h1>Eat<br>everything.<br>Twice.</h1> — accessible name normalizes <br>s
  // to whitespace differently across browsers; use a tolerant regex.
  await expect(page.getByRole("heading", { level: 1 }))
    .toContainText(/Eat\s*everything\.\s*Twice\./);
  await expect(page.getByRole("heading", { level: 2, name: "Right off the stove" })).toBeVisible();
});

test("aria-current is set on the matching nav link when visiting an interior page", async ({ page }) => {
  // The Bold Red Poster nav intentionally has no "Home" link — the wordmark
  // links to / instead. Visit an interior page to verify the aria-current
  // mechanism wires up correctly.
  await page.goto("/about");
  const active = page.locator('nav[aria-label="Main navigation"] a[aria-current="page"]').first();
  await expect(active).toHaveText("About");
});
```

### archive.spec.ts and categories.spec.ts

Single-line label swaps:

```typescript
// archive.spec.ts:44
await expect(active).toHaveText("Stories");  // was "Archive"

// categories.spec.ts:34
await expect(active).toHaveText("Cities");  // was "Categories"
```

Also update `src/pages/tests-admin.json.ts` `covers:` descriptions for the same files so the `/admin → Testing` dashboard stays accurate.

## Bonus gotcha: stale `astro dev` server breaks local E2E re-runs

While verifying the fix locally, a *new* failure appeared that wasn't in CI:

```
Error: strict mode violation: locator('h1') resolved to 5 elements:
  1) <h1>June 2022</h1>           ← the real page heading
  2) <h1>No islands detected.</h1>
  3) <h1>Audit</h1>
  4) <h1>No accessibility or performance issues detected.</h1>
  5) <h1>Settings</h1>
```

Items 2–5 are from the **Astro Dev Toolbar**, which `astro dev` injects into every page but `astro preview` does not. The test was running against a different server than CI uses.

### Why

`playwright.config.ts` does:

```typescript
webServer: prodBaseURL ? undefined : {
  command: "npm run preview",
  url: "http://localhost:4321",
  reuseExistingServer: !process.env.CI,   // ← the trap
  timeout: 120_000,
}
```

`reuseExistingServer: !CI` is intentional — locally it reuses an already-running server on `:4321` so re-runs are fast. But if you happened to start `astro dev` (not `astro preview`) earlier in the session and forgot to kill it, Playwright happily reuses it. The dev toolbar's HTML pollutes every page with phantom h1s, and any test using `page.locator('h1')` (without a more specific selector) hits a strict-mode violation.

In CI, `process.env.CI=true` flips `reuseExistingServer` to `false`, and Playwright always boots a fresh `astro preview`. So the failure is local-only.

### The fix

```bash
# Diagnose:
lsof -i :4321 -P -n
# If a process is listed and you didn't intend it, that's the bug.

# Fix:
kill <pid>
# Or globally: pkill -f "astro dev"

# Then re-run:
npx playwright test --project=chromium
```

## Prevention

### When renaming user-facing text

Before merging a PR that renames any visible nav label, heading, button, or link text:

1. **Grep tests/e2e/ for the old string**:
   ```bash
   git grep -n "Archive\|Categories\|The Thirsty Pig\|Recent Posts" tests/e2e/
   ```
   Update assertions before merging.

2. **Run E2E locally on the redesign branch**:
   ```bash
   npm run build && npm run test:e2e
   ```
   Takes ~5 min; finds 100% of these issues.

3. **Add an explicit "ran E2E" checkbox** to PR descriptions for visual redesigns.

### When running Playwright locally

1. **Check :4321 is free** before running E2E:
   ```bash
   lsof -i :4321 -P -n || echo "port free"
   ```

2. **Prefer `astro preview` over `astro dev`** when manually testing site behavior — `preview` serves the built `dist/` and matches what CI sees.

3. If you used `astro dev` for a visual review (e.g., to show someone a design via HMR), **kill the process before running E2E**.

### Considered but rejected

- **Loosen E2E assertions to test routes, not text** (e.g., assert the `aria-current` link's `href`, not its `toHaveText`). Tradeoff: faster to ship redesigns but loses copy-regression detection. For a personal blog where copy matters, keep the text assertions.
- **Run E2E in pre-commit (Tier 1)**. Adds ~5 min to every commit on a personal blog. Not worth it for the rare visual-redesign case.

## Related

- `docs/solutions/feature-implementations/testing-stack-three-tier-cadence.md` — the four-tier design that explains why E2E only runs at Tier 2
- `docs/solutions/feature-implementations/pre-staged-tests-awaiting-data-activation.md` — sister pattern for the opposite problem (test exists but data doesn't yet)
- `docs/testing.md` — canonical reference for the test stack
- [PR #72](https://github.com/thirstypig/thirstypig-blog/pull/72) — Bold Red Poster redesign that introduced the renames
- [PR #79](https://github.com/thirstypig/thirstypig-blog/pull/79) — E2E fix
- [Failing CI run 25028252786](https://github.com/thirstypig/thirstypig-blog/actions/runs/25028252786) — original failure
- [Green post-fix CI run 25028825935](https://github.com/thirstypig/thirstypig-blog/actions/runs/25028825935) — confirmed clean

## Time cost

- First time hitting it (this session): ~25 minutes
  - 3 min — fetch CI logs, identify failing assertions
  - 5 min — read each spec, map old labels to new labels
  - 3 min — edit assertions
  - 8 min — false-positive rabbit hole (stale dev server)
  - 4 min — verify locally, push, watch CI
  - 2 min — write up commit + PR
- Next time hitting it (with this doc): expected ~5 minutes
  - The two `lsof` + `git grep` checks above shave the diagnostic time to near-zero
