# Testing

## The two kinds we run

| | Unit tests | E2E tests |
|---|---|---|
| **What** | One function, isolated | Real browser, real built site |
| **Tool** | [Vitest](https://vitest.dev) for JS/TS, [pytest](https://docs.pytest.org) for Python | [Playwright](https://playwright.dev) |
| **Where** | JS: `src/**/*.test.{ts,mjs}` · Python: `scripts/test_*.py` | `tests/e2e/**/*.spec.ts` |
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
# Typecheck everything (src/, tina/, scripts/*.mjs) — ~14s with 4GB heap
npm run typecheck

# JS/TS unit tests — fast, runs in Node
npm run test:unit           # one-shot
npm run test:unit:watch     # watch mode while iterating

# Python unit tests — via pytest
npm run test:py             # or: python3 -m pytest scripts/

# E2E tests — spins up astro preview on port 4321, drives Chromium
npm run test:e2e            # headless
npm run test:e2e:ui         # Playwright UI mode (great for debugging)

# Everything
npm run test
```

First-time setup on a fresh checkout:

```bash
npm install                            # incl. typescript + @astrojs/check + @types/*
npx playwright install chromium        # E2E browser
pip install -r requirements-dev.txt    # pytest + pyyaml
npm run setup:hooks                    # pre-commit hook
```

### Why `tsc --noEmit`, not `astro check`?

`astro check` OOMs on this project — it tries to type-check every generated post route (2,120 posts × schema) and blows past 8 GB of heap. Plain `tsc --noEmit` with the existing `tsconfig.json` runs in ~14 s against a 4 GB heap and covers every `.ts` / `.tsx` / `.mjs` file under `src/`, `tina/`, and `scripts/`. It's what `npm run typecheck` runs.

The `setup:hooks` command points git at `.githooks/`, which makes the pre-commit
hook run automatically before every commit. See the Cadence section for what
it runs.

## Cadence

Four tiers, of which we currently run tier 2. The rest are planned:

| Tier | Trigger | Runs | Duration | Status |
|---|---|---|---|---|
| 1 | Pre-commit hook | `validate_hitlist` + JS unit + Python unit | ~0.5 s | **Active** — `.githooks/pre-commit` (opt-in via `npm run setup:hooks`) |
| 2 | GitHub Actions on every PR + push to `main` | JS unit + Python unit + E2E (parallel jobs) | ~1-3 min | **Active** — `.github/workflows/test.yml` |
| 3 | Nightly cron against production | E2E suite hitting `thirstypig.com` | ~1-3 min | **Active** — `.github/workflows/nightly.yml`, 11:00 UTC daily |
| 4 | Pre-deploy smoke | Handful of critical E2E | ~30 s | **Skip** — over-engineered for this project's scale |

### Bypassing the pre-commit hook

```bash
git commit --no-verify -m "WIP, will fix tests"
```

Use sparingly — CI will still catch regressions on the push, and a failing
test on `main` blocks everyone. If the hook is legitimately broken, fix the
hook before merging.

## What's covered today

See the Testing dashboard at `/admin → Testing` for the live inventory, or look
at `src/pages/tests-admin.json.ts` directly.

At a glance:

- **`src/utils.test.ts`** (6 unit assertions) — `slugify()` behavior
- **`src/plugins/remark-image-optimize.test.mjs`** (5 unit assertions) —
  `buildPictureHtml()` HTML emission, WebP source presence, HTML escaping
- **`scripts/test_sync_hitlist.py`** (25 unit assertions) — Hit List vault
  parser: header parsing, metadata keys, tag normalization, priority bounds,
  id slugification and override, unknown-key drop, CJK handling
- **`scripts/test_post_utils.py`** (18 unit assertions) — frontmatter parser
  is crash-free on malformed input; dead-URL helpers; the
  current-vs-legacy-domain distinction (caught a subtle regression during
  test writing)
- **`scripts/test_seed_hitlist_vault.py`** (14 unit assertions) —
  `entry_to_md()` field formatting + omission of empty fields;
  integration round-trip that loads the real `places-hitlist.yaml`, seeds it
  to markdown, parses it back, and asserts every id/name/city/priority/tag/
  link survived. Guards the Hit List Phase 4 vault-sync path against silent
  id corruption on switch-over.
- **`tests/e2e/homepage.spec.ts`** (4 E2E assertions) — hero renders, nav
  `aria-current`, skip link works, theme toggle persists
- **`tests/e2e/hitlist.spec.ts`** (5 E2E assertions) — cards render, city
  filter narrows, tag filter narrows, clear-filters resets, nav `aria-current`
- **`tests/e2e/search.spec.ts`** (4 E2E assertions) — initial state + total
  count, debounced typing narrows, `<picture>` with WebP source is emitted,
  no-results state on gibberish
- **`tests/e2e/map.spec.ts`** (3 E2E assertions) — page shell + legend,
  Leaflet initializes and paints markers, marker count populates
- **`tests/e2e/post-page.spec.ts`** (7 E2E assertions) — post regression
  suite: h1 singleton + no heading-level skips, hero `<picture>` + WebP +
  dimensions, body images optimized, LocationCard renders, no unexpected
  console errors, skip link works
- **`tests/e2e/closed-venues.spec.ts`** (1 E2E assertion, currently skipped)
  — dynamic fixture picks a closed post from `/search.json`, asserts the
  CLOSED badge + `grayscale` class render in search results. Test skips
  cleanly today because all 37 closed-venue posts in `src/content/posts/`
  are `draft: true` and therefore excluded from `/search.json`. The
  `isClosed` rendering branches in `PostCard`, `search.astro`, and
  `RelatedPosts` are currently **unreachable in production** — the test is
  pre-staged to start working the moment any closed venue is flipped live.
- **`src/utils/image-dimensions.test.mjs`** (13 unit assertions) —
  `webpSibling()` path transforms + `getImageInfo` integration using
  generated temp fixture files with the `{publicDir, cache: false}` test
  options (file-missing fallback, real sharp dimension reads, WebP sibling
  detection, portrait orientation preserved, non-absolute path rejection)
- **`tests/e2e/archive.spec.ts`** (4 E2E assertions) — `/archive/*`:
  index + year page + year-month page + Archive nav aria-current
- **`tests/e2e/categories.spec.ts`** (3 E2E assertions) — `/categories/*`:
  index + individual category page + Categories nav aria-current
- **`tests/e2e/pagination.spec.ts`** (3 E2E assertions) — `/posts/N/`:
  grid renders, Next link (scoped to nav aria-label=Pagination) navigates,
  Previous is disabled on page 1
- **`tests/e2e/static-pages.spec.ts`** (4 E2E assertions) — `/about`,
  `/best-of`, `/changelog` each render heading + stable content
- **`tests/e2e/feeds.spec.ts`** (3 E2E assertions) — `/rss.xml`,
  `/sitemap-index.xml`, `/robots.txt` return correct content-types +
  expected structural markers
- **`tests/e2e/endpoints.spec.ts`** (5 E2E assertions) — build-time JSON
  shape + self-consistency invariants across `/tests-admin.json` (counters
  match actual entries), `/stats.json`, `/posts-admin.json`, `/search.json`
  (PR #40 WebP-metadata regression guard), `/places-hitlist.json`. Written
  so a silent field rename in any generator blows up in CI instead of the
  admin dashboard.

## What to test next

In rough priority order (pick based on what you're editing):

Phase A (site page coverage) and Phase B (endpoint schema checks) are
complete. Remaining low-priority follow-ups:

1. **Phase C — Missing unit coverage** — `remark-instagram-mentions.mjs`,
   extractable helpers from `Pagination.astro`, `FormattedDate.astro`,
   `LocationCard.astro`. ~45 min.
2. **Phase D — Python script tests** — `mark_imageless_drafts.py`,
   `strip_dead_images.py`. Extract pure helpers first, then pytest. ~45 min.
3. **Flip a few closed venues to `draft: false`** — content decision. Would
   activate the `isClosed` rendering branches on the live site and
   auto-un-skip `tests/e2e/closed-venues.spec.ts`.
5. **Browser matrix expansion** — Playwright currently runs Chromium only.
   Adding Firefox + WebKit is one config edit but ~3× the CI minutes. Worth
   revisiting if a Safari-specific bug ever slips through.
6. **Visual regression** — Playwright snapshot assertions on stable pages.
   Flaky on content-heavy sites like this one; defer unless you start seeing
   layout regressions in prod.

## How to add a new test

### A JS/TS unit test

1. Create `foo.test.ts` next to `foo.ts` (or `foo.test.mjs` for MJS modules).
2. Import the thing you're testing. Export it from the source file if it
   isn't already (see how `buildPictureHtml` was exported for its test).
3. Use `describe` / `it` / `expect` from Vitest.
4. Run `npm run test:unit:watch` while you write — Vitest re-runs on save.
5. When green, update `src/pages/tests-admin.json.ts` with the new entry.

### A Python unit test

1. Create `scripts/test_foo.py` next to `scripts/foo.py`.
2. Import the thing you're testing: `from foo import something`.
3. Use pytest classes (`class TestX:`) for grouping, plain `def test_*` for
   assertions, and `@pytest.mark.parametrize` for table-driven cases.
4. Run `npm run test:py` (or `python3 -m pytest scripts/test_foo.py -v`).
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
