# Testing

## The two kinds we run

| | Unit tests | E2E tests |
|---|---|---|
| **What** | One function, isolated | Real browser, real built site |
| **Tool** | [Vitest](https://vitest.dev) | [Playwright](https://playwright.dev) |
| **Where** | `src/**/*.test.{ts,mjs}` + `scripts/**/*.test.{ts,mjs}` | `tests/e2e/**/*.spec.ts` |
| **Speed** | Milliseconds per test | ~1s per test |
| **What they prove** | The code is correct | The site works |

**Unit tests** prove a function behaves right for its inputs — no browser, no
network, no files. They're fast and they're what you run while you edit.

**E2E tests** prove the whole pipeline (HTML shell → CSS → JS → interactive
behavior) works together. They catch bugs unit tests structurally can't see:
CSS regressions, JS hydration failures, routing breakage, accessibility
regressions.

**You need both.** A parser can be unit-test-perfect but wired into the wrong
place, and the user still sees a broken page. An E2E test can pass on the
happy path while an edge-case bug lurks in a function nobody exercises.

## How to run them

```bash
# Unit tests — fast, runs in Node
npm run test:unit           # one-shot
npm run test:unit:watch     # watch mode while iterating

# E2E tests — spins up astro preview on port 4321, drives Chromium
npm run test:e2e            # headless
npm run test:e2e:ui         # Playwright UI mode (great for debugging)

# Everything
npm run test
```

First E2E run on a fresh checkout needs Chromium installed:

```bash
npx playwright install chromium
```

## Cadence

Four tiers, of which we currently run tier 2. The rest are planned:

| Tier | Trigger | Runs | Duration | Status |
|---|---|---|---|---|
| 1 | Pre-commit hook | Fastest unit tests + `validate_hitlist.mjs` | ~2-5 s | **Not yet — opt-in `npm run test:unit` for now** |
| 2 | GitHub Actions on every PR + push to `main` | All unit + E2E | ~1-3 min | **Active** — `.github/workflows/test.yml` |
| 3 | Nightly cron against production | E2E suite hitting `thirstypig.com` | ~1-3 min | **Not yet — add once tier 2 is stable for a few weeks** |
| 4 | Pre-deploy smoke | Handful of critical E2E | ~30 s | **Skip** — over-engineered for this project's scale |

## What's covered today

See the Testing dashboard at `/admin → Testing` for the live inventory, or look
at `src/pages/tests-admin.json.ts` directly.

At a glance:

- **`src/utils.test.ts`** (6 unit assertions) — `slugify()` behavior
- **`src/plugins/remark-image-optimize.test.mjs`** (5 unit assertions) —
  `buildPictureHtml()` HTML emission, WebP source presence, HTML escaping
- **`tests/e2e/homepage.spec.ts`** (4 E2E assertions) — hero renders, nav
  `aria-current`, skip link works, theme toggle persists

## What to test next

In rough priority order (pick based on what you're editing):

1. **Hit List parser** — `scripts/sync_hitlist_from_md.py`. Highest-churn code
   with most edge cases (header parsing, tag normalization, unknown-key drop,
   default values, id slugification). Python code — either add pytest or port
   the parser to JS. Recommend pytest + add a `test:py` npm script.
2. **`/hitlist` E2E** — filter by city, filter by tag, clear-filters button,
   empty state, priority badge rendering.
3. **`/search` E2E** — debounced search finds posts, renders `<picture>` with
   WebP source, closed posts show CLOSED badge.
4. **`/map` E2E** — map loads, markers render, closed markers use dashed ring,
   popup works. Flakier than the others; mark `test.slow()` or run serially.
5. **Unit — `post_utils.py`** — `frontmatter_close_index()` edge cases (no
   opening delim, no closing delim, stray `---` in values). Needs pytest.
6. **Unit — `src/utils/image-dimensions.mjs`** — cache hit/miss logic,
   graceful fallback on missing files. Needs mocking `sharp` — slightly more
   setup.

## How to add a new test

### A unit test

1. Create `foo.test.ts` next to `foo.ts` (or `foo.test.mjs` for MJS modules).
2. Import the thing you're testing. Export it from the source file if it
   isn't already (see how `buildPictureHtml` was exported for its test).
3. Use `describe` / `it` / `expect` from Vitest.
4. Run `npm run test:unit:watch` while you write — Vitest re-runs on save.
5. When green, update `src/pages/tests-admin.json.ts` with the new entry.

### An E2E test

1. Create `tests/e2e/<feature>.spec.ts`.
2. Import `{ test, expect }` from `@playwright/test`.
3. Prefer role-based locators (`getByRole`, `getByLabel`) over CSS selectors
   — they double as accessibility smoke tests.
4. `npm run test:e2e:ui` opens Playwright's UI for step-by-step debugging.
5. When green, update `src/pages/tests-admin.json.ts`.

## Why we don't have 100% coverage (and never will)

This is a personal experimentation blog, not a bank. Coverage targets cost
more than they return on a static site with few interactive surfaces. We
prioritize:

- High-churn code (parsers, transformers) — unit tests pay back hugely
- Interactive features users rely on (theme toggle, search, hitlist filters)
  — E2E tests pay back hugely
- Accessibility guarantees (skip link, `aria-current`, focus management) —
  regress silently without tests

And we explicitly don't bother with:

- Pure presentational components (`PostCard` rendering a title)
- Build-time content (every post's HTML would be a 2,100-case E2E matrix)
- CSS visual regression — Playwright snapshot testing is flaky on a static
  content site that legitimately changes often

## When a test fails in CI

1. Look at the Actions log — Playwright uploads traces on failure
2. Reproduce locally: `npm run test:e2e` (or `test:unit`)
3. If the test is actually wrong, fix the test
4. If the code is actually wrong, fix the code
5. **Never** skip a test with `.skip` without an issue link and a dated TODO
