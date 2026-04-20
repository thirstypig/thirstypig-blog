---
title: "Testing stack: Vitest + pytest + Playwright, three-tier cadence, 105 assertions"
date: 2026-04-20
category: feature-implementations
tags:
  - testing
  - vitest
  - pytest
  - playwright
  - github-actions
  - pre-commit
  - ci
  - tinacms-admin
components_affected:
  - vitest.config.ts
  - playwright.config.ts
  - .githooks/pre-commit
  - .github/workflows/test.yml
  - .github/workflows/nightly.yml
  - src/pages/tests-admin.json.ts
  - tina/TestingDashboard.tsx
  - tina/config.ts
  - docs/testing.md
  - requirements-dev.txt
prs:
  - "#45"
  - "#46"
  - "#47"
  - "#48"
  - "#49"
  - "#50"
  - "#51"
  - "#52"
status: implemented
---

# Testing stack: three-tier cadence, 105 assertions, four real bugs caught during construction

## Overview

Eight PRs built a complete testing loop from scratch for a project that had zero tests. The final state: **12 test files, 105 assertions, ~6 seconds wall time, three of four cadence tiers live.** Along the way, four real production bugs got caught by the tests themselves as they were being written.

## Problem

Before PR #45, the project had no automated tests at all. The only safety net was `scripts/validate_hitlist.mjs` — a schema checker, not a test — running as part of the build. Regressions were caught manually by the human running `astro build`, or not at all.

Specific risks this left:
- **The image pipeline** (PR #35, the biggest perf investment) could silently regress. A typo in `remark-image-optimize.mjs` would ship.
- **The Hit List vault parser** (PR #42) had 12+ edge cases in mobile-friendly markdown handling with no regression guards.
- **The TinaCMS admin screens** touched external data and could break silently on field renames.
- **Accessibility work** (PR #36: skip link, `aria-current`, focus-visible) had no test of record — a future refactor could undo it without anyone noticing.

## Solution architecture

### Stack selection

Three runners, each for a specific kind of code:

| Code class | Tool | Location |
|---|---|---|
| JS/TS pure functions + Astro-rendered components | **Vitest** | `src/**/*.test.{ts,mjs}` co-located next to source |
| Python scripts (parser, validator, seeder) | **pytest** | `scripts/test_<name>.py` co-located next to source |
| End-to-end user flows | **Playwright** | `tests/e2e/<feature>.spec.ts` |

Vitest and Playwright are the Astro-ecosystem defaults. pytest was added specifically for the Python scripts — using Vitest would have required porting the parser to JS (wasted effort). The cost is a third test runner, offset by pytest's class-scope fixtures and `parametrize` decorator which keep Python tests extremely dense.

### Cadence — four tiers, three active

```
Tier 1  pre-commit     ~1.7 s    every local commit          ACTIVE
Tier 2  CI on PR/push  ~2 min    every PR, every main push   ACTIVE
Tier 3  nightly cron   ~2 min    11:00 UTC against prod       ACTIVE
Tier 4  pre-deploy     ~30 s     before Vercel promotes      SKIPPED (over-engineered)
```

- **Tier 1** runs `validate:hitlist + test:unit + test:py` via `.githooks/pre-commit`. 1.7 s cold, zero new deps. Activated per-clone via `npm run setup:hooks` which writes `core.hooksPath = .githooks` to the local git config.
- **Tier 2** runs all of the above plus E2E via `.github/workflows/test.yml` — three parallel jobs on every PR and push to main.
- **Tier 3** runs the E2E suite against `https://thirstypig.com` via `.github/workflows/nightly.yml`, triggered by cron at 11:00 UTC. Catches deploy regressions, CDN drift, upstream API issues. The `PLAYWRIGHT_BASE_URL` env var in `playwright.config.ts` flips the target from local preview to production without changing test code.
- **Tier 4** is intentionally skipped. Vercel doesn't have a pre-promote hook that fits our needs, and the scale doesn't warrant the complexity.

### Admin visibility

`/admin → Testing` is a TinaCMS Screen Plugin that fetches `/tests-admin.json` at runtime. The JSON is generated at build time from `src/pages/tests-admin.json.ts` — a hand-maintained static inventory today (Phase 1). A future Phase 2 could wire CI artifacts into this endpoint for live pass/fail status. The admin screen shows file name, test kind (unit/e2e), one-line coverage description, assertion count, and status badge.

## Non-obvious design decisions

### 1. `tsc --noEmit` over `astro check` (PR #52)

`astro check` OOMs on this project even at 8 GB heap — it tries to type-check all 2,120 content routes. Plain `tsc --noEmit` with `NODE_OPTIONS="--max-old-space-size=4096"` runs in ~14 s against the existing `tsconfig.json` and produces zero errors (after fixing 2 pre-existing TS issues in `tina/*` that were hiding behind a missing `@types/react`). The typecheck is NOT in the pre-commit hook — 14 s is too slow per commit — but it's recommended as a pre-push or CI gate.

### 2. Plain git hook over husky (PR #50)

Husky would add a dependency, a `prepare` script, a `.husky/` directory, and magic. Plain shell hook at `.githooks/pre-commit` + `git config core.hooksPath .githooks` does the same job in 21 lines of bash you can read in 30 seconds. Trade-off: collaborators on a fresh clone have to run `setup:hooks` manually. Acceptable for a personal project.

### 3. Dynamic-fixture tests that skip on missing data (PR #51)

The closed-venue E2E test uses `request.get('/search.json')` at test time to find a closed post, then asserts the CLOSED badge renders. When no closed posts exist in the index (as is the case today — all 37 closed-venue source files are `draft: true`), the test calls `test.skip()` with a clear reason instead of failing. The test is **pre-staged** — it'll start working the moment any closed venue flips live, with no test changes needed. This pattern is worth repeating for any assertion that depends on specific content.

### 4. `publicDir` + `cache` options on `getImageInfo` (PR #51)

The util held a module-level `PUBLIC_DIR` constant and a global cache — nearly impossible to test in isolation. Adding an optional `options` parameter with sensible defaults was a ~5-line change at one call site with zero impact at production call sites (they pass nothing and get the defaults), but it unlocked clean integration testing with temp fixture directories.

### 5. pytest class-scope fixtures for round-trip integration (PR #49)

`TestRoundTrip` in `scripts/test_seed_hitlist_vault.py` runs the full YAML → md → re-parsed pipeline **once**, then 7 assertions read the shared result. Without `@pytest.fixture(scope="class")` the pipeline would run 7 times. With it, the integration runs in ~50 ms for 7 strong assertions. Pattern worth reaching for anytime multiple assertions share an expensive setup.

### 6. Role-based Playwright locators double as a11y regression tests

Every `getByRole('link', { name: 'Skip to content' })` assertion in the suite passes only if the element exists AND has its accessible name. Four of the 24 E2E assertions would auto-fail if someone stripped an accessible name — free accessibility regression coverage.

## Bugs caught during construction

These weren't goals of writing the tests — they were side-effects. Every one would have reached production (or had reached production) without the suite.

### 1. RelatedPosts skipped heading level h2 (caught by PR #48's first run)

The RelatedPosts component emitted `<h3>You might also enjoy</h3>` inside a document whose main heading is `<h1>` — skipping h2. WCAG heading-hierarchy violation. Fixed in the same PR: h3 → h2, h4 → h3.

### 2. RelatedPosts thumbnails missed PR #35's image pipeline (same PR)

PR #35 wired three surfaces (PostCard, BlogPost hero, markdown images) through `getImageInfo()` for WebP delivery. RelatedPosts was missed. Every post page with matches — which is most of them — was shipping 4 unoptimized JPG thumbnails. The post-page E2E fired on "body images have explicit width and height" and surfaced the gap. Fixed in the same PR.

### 3. `thirstypig.com` vs `thethirstypig.com` live-vs-legacy (PR #46, during test writing)

My own first draft of `test_post_utils.py` asserted `is_dead_image_url("https://thirstypig.com/old-image.jpg") is True`. It failed. Turns out `thirstypig.com` (no "the") is the **current live site**, and only `thethirstypig.com` (with "the") is the dead WordPress. Writing the test surfaced a mental-model bug. Captured as a permanent regression guard.

### 4. isClosed rendering is dead code in production (PR #51)

The `isClosed` branches in `PostCard`, `search.astro`, and `RelatedPosts` check for a `"closed"` tag or "closed" in the title. The closed-venue E2E fetched `/search.json`, looked for a matching post, and found **zero** — because all 37 closed-venue source files are `draft: true`, excluding them from the index. The branches exist, have no data to trigger them, and would silently never run on the live site. This is a content decision (not code) — noted as a follow-up.

## Patterns worth remembering

1. **Three-runner stack works when each runner has a clear scope.** Don't use Vitest for Python code just to consolidate. Don't use pytest for JS just because the parser is Python-adjacent. Match the runner to the code.
2. **Class-scope fixtures for integration, function-scope for unit.** Integration tests that share expensive setup benefit enormously.
3. **Tests should skip cleanly on missing fixtures** — a test that fails because no data exists is a false positive; a test that skips with "no closed posts in index" is honest.
4. **Role-based Playwright locators are a11y tests in disguise.** Always prefer `getByRole`/`getByLabel` over CSS selectors.
5. **The tests that surface bugs during construction are the most valuable** — they prove the suite catches real things, not just the things we pre-imagined.
6. **"Untested" is a valid status** — `closed-venues.spec.ts` shows as `untested` in the admin dashboard because it can't run against current data. Don't lie with a "passing" badge just to look green.

## Totals

| Layer | Files | Assertions | Duration |
|---|---|---|---|
| JS/TS unit (Vitest) | 3 | 24 | ~200 ms |
| Python unit (pytest) | 3 | 57 | ~0.3 s |
| E2E (Playwright) | 6 | 24 (23 active + 1 pre-staged skip) | ~5 s |
| **Total** | **12** | **105** | **~6 s** |

## Follow-ups

- **Phase 2 admin dashboard** — wire real CI artifact pass/fail status into `/tests-admin.json` so the screen reflects the actual latest run, not hand-maintained snapshots.
- **Browser matrix** — Chromium only today; adding Firefox and WebKit is a one-line config change but ~3× CI minutes.
- **Content decision** — flip a few closed venues to `draft: false` to activate the `isClosed` rendering branches on the live site (auto-un-skips `closed-venues.spec.ts`).
- **Typecheck as CI job** — 14 s not suitable for pre-commit, but would be a good addition to `.github/workflows/test.yml` as a fourth parallel job.
