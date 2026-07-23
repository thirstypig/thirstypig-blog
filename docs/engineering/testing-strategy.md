---
id: DOC-010
type: testing
status: active
phase: null
owner: james
tags: [build-deploy, docs-system]
links: [DOC-007, PRD-001]
updated: "2026-07-23"
---

# Testing strategy

> Merged from the former `docs/testing.md` (2026-07-23, C-001) so the board indexes one
> testing doc. Everything below is that content, plus the "ugly cases" table and the
> docs-system tests section.

## The two kinds we run

| | Unit tests | E2E tests |
|---|---|---|
| **What** | One function, isolated | Real browser, real built site |
| **Tool** | [Vitest](https://vitest.dev) for JS/TS, [pytest](https://docs.pytest.org) for Python | [Playwright](https://playwright.dev) |
| **Where** | JS: `src/**/*.test.{ts,mjs}` · Python: `scripts/test_*.py` | `tests/e2e/**/*.spec.ts` |
| **Speed** | Milliseconds per test | ~1s per test |
| **What they prove** | The code is correct | The site works |

**Unit tests** prove a function behaves right for its inputs — no browser, no network, no
files. They're fast and they're what you run while you edit.

**E2E tests** prove the whole pipeline (HTML shell → CSS → JS → interactive behavior) works
together. They catch bugs unit tests structurally can't see: CSS regressions, JS hydration
failures, routing breakage, accessibility regressions.

**You need both.** A parser can be unit-test-perfect but wired into the wrong place, and
the user still sees a broken page. An E2E test can pass on the happy path while an
edge-case bug lurks in a function nobody exercises.

Current totals: **172 Vitest + 178 pytest** unit assertions, plus the E2E suite.

## Ugly cases — the failure modes that have actually bitten us

Not "what do we test" but "what has hurt us, and is it guarded now?"

| # | Ugly case | Guarded today? |
|---|---|---|
| U1 | **Silent-success pipeline steps** — a script runs clean and produces zero output | ❌ Only by hand. The lesson is *count assertions*, applied inconsistently. |
| U2 | **Cross-parser strictness** — PyYAML accepts what js-yaml rejects (duplicate keys) | ✅ `test_venues_yaml_no_duplicate_keys.py` |
| U3 | **YAML type coercion** — bare dates become Date objects; UTF-8 corrupts through `atob` | ⚠️ Partial. Encoding centralized in `github-contents.ts`, but untested. |
| U4 | **Geocoding autofill contamination** — a confident wrong-business match writes name, address, coords, place_id together | ✅ `data-quality.test.ts` guards the detection heuristic |
| U5 | **Docs pointing at deleted files** — `components:` frontmatter naming retired code | ❌ Nothing validates those paths. Cheap to add to `docs:refresh`. |
| U6 | **Silent render-nothing** — `venue-tags.ts` returns `null` on unreadable JSON; page renders empty with a green build | ❌ Still no test. See TD-005. |
| U7 | **E2E coupled to UI text** — a copy rename breaks specs, only on Tier 2 CI | ✅ Documented; run `npm run test:e2e` locally before visual PRs. |
| U8 | **Build-time endpoint shape drift** — `/places-hitlist.json` consumed by another codebase | ✅ `tests/e2e/endpoints.spec.ts` asserts shapes |
| U9 | **Non-ASCII lost at tool boundaries** — `atob`/`btoa`, `\xa0` folder names, `git ls-files` C-quoting 227 CJK posts | ⚠️ Known class (RISK-005), guarded case-by-case, not systematically |

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

`astro check` OOMs on this project — it tries to type-check every generated post route
(2,120 posts × schema) and blows past 8 GB of heap. Plain `tsc --noEmit` with the existing
`tsconfig.json` runs in ~14 s against a 4 GB heap and covers every `.ts` / `.tsx` / `.mjs`
file under `src/`, `tina/`, and `scripts/`. It's what `npm run typecheck` runs.

The `setup:hooks` command points git at `.githooks/`, which makes the pre-commit hook run
automatically before every commit.

## Cadence

Four tiers, of which we currently run tiers 1–3.

| Tier | Trigger | Runs | Duration | Status |
|---|---|---|---|---|
| 1 | Pre-commit hook | `validate_hitlist` + JS unit + Python unit | ~0.5 s | **Active** — `.githooks/pre-commit` (opt-in via `npm run setup:hooks`) |
| 2 | GitHub Actions on every PR + push to `main` | JS unit + Python unit + E2E (parallel) | ~1-3 min | **Active** — `.github/workflows/test.yml` |
| 3 | Nightly cron against production | E2E suite hitting `thirstypig.com` | ~1-3 min | **Active** — `.github/workflows/nightly.yml`, 11:00 UTC daily |
| 4 | Pre-deploy smoke | Handful of critical E2E | ~30 s | **Skip** — over-engineered for this scale |

### Bypassing the pre-commit hook

```bash
git commit --no-verify -m "WIP, will fix tests"
```

Use sparingly — CI still catches regressions on push, and a failing test on `main` blocks
everyone. If the hook is legitimately broken, fix the hook before merging.

## What's covered today

Live inventory: `/admin → Testing`, or `src/pages/tests-admin.json.ts`. At a glance:

- **`src/utils/doc-index.test.ts`** (31) — docs-board routing/title/section logic: the
  code-fence-guarded H1 extraction, section-by-intent mapping, path overrides, exclusions.
- **`src/utils/markdown-lite.test.ts`** (36) — the docs-board markdown renderer, including
  adversarial XSS cases (script tags, `onerror`, `javascript:`/`data:` links, quote
  breakout) that justify its `dangerouslySetInnerHTML`.
- **`src/utils/data-quality.test.ts`** (23) — Cleanup admin detection heuristics; paired
  bug/legit fixtures (Pine & Crane / Wolf & Crane, Rou Jia Mo / A Niang with CJK preserved).
- **`src/utils/image-validation.test.ts`** (10) — `isSafeSrc()`; caught a real
  subdomain-spoof bug (`https://thirstypig.com.evil.com/`) during writing.
- **`scripts/venue-tags/test_lookup_place_ids_api.py`** (16) — anchored to two silent-fail
  modes: `extract_fid_hex` → None on a valid URI, `write_yaml_field` regex no-op.
- **`scripts/test_strip_dead_images.py`** (17) — regex content cleaner; caught a `+`-vs-`*`
  regex bug while writing.
- **`scripts/instagram/test_import_instagram.py`** (7) — date-based dedup; the bug that
  would have re-published 6 March posts.
- Plus: `remark-*` plugin tests, `test_post_utils.py`, `test_sync_hitlist.py`,
  `test_seed_hitlist_vault.py`, `test_mark_imageless_drafts.py`, `pagination`,
  `location-links`, `regions`, `image-dimensions`, `aggregate-chips`, `hitlist-entry`.
- **E2E** (`tests/e2e/`): homepage, hitlist, search, map, consent (the privacy-critical
  "trackers ship inert before opt-in" invariant), post-page, archive, categories,
  pagination, static-pages, feeds, endpoints, closed-venues (pre-staged, skips cleanly).

## Docs-system tests

Spec item #6 for the docs board calls for tests on **title extraction**, **code-fence
guard**, **section grouping**, and **exclusions** — all live in `doc-index.test.ts`.

**`docs/testing.md`'s old body was itself the adversarial fixture:** it contained bash
blocks whose comment lines start with `# `, e.g.

```
# Typecheck everything (src/, tina/, scripts/*.mjs) — ~14s with 4GB heap
```

A naive H1 scan finds several `# ` lines there; only the real heading should win. The guard
is `raw.replace(/```[\s\S]*?```/g, "")` before matching — tested directly in
`doc-index.test.ts` against exactly this shape.

## How to add a new test

### A JS/TS unit test
1. Create `foo.test.ts` next to `foo.ts` (or `foo.test.mjs` for MJS modules).
2. Import the thing you're testing; export it from the source if it isn't already.
3. Use `describe` / `it` / `expect` from Vitest.
4. Run `npm run test:unit:watch` while you write.
5. When green, update `src/pages/tests-admin.json.ts`.

### A Python unit test
1. Create `scripts/test_foo.py` next to `scripts/foo.py`.
2. `from foo import something`.
3. pytest classes for grouping, `@pytest.mark.parametrize` for table-driven cases.
4. `npm run test:py` (or `python3 -m pytest scripts/test_foo.py -v`).
5. When green, update `src/pages/tests-admin.json.ts`.

### An E2E test
1. Create `tests/e2e/<feature>.spec.ts`.
2. `import { test, expect } from "@playwright/test"`.
3. Prefer role-based locators (`getByRole`, `getByLabel`) — they double as a11y smoke tests.
4. `npm run test:e2e:ui` for step-by-step debugging.
5. When green, update `src/pages/tests-admin.json.ts`.

## Why we don't have 100% coverage (and never will)

Personal experimentation blog, not a bank. We prioritize high-churn code (parsers,
transformers), interactive features users rely on (theme toggle, search, hitlist filters),
and accessibility guarantees (skip link, `aria-current`, focus). We explicitly skip pure
presentational components, build-time content (a 2,100-case E2E matrix), and CSS visual
regression (flaky on a content-heavy static site).

## When a test fails in CI

1. Look at the Actions log — Playwright uploads traces on failure.
2. Reproduce locally: `npm run test:e2e` (or `test:unit`).
3. If the test is wrong, fix the test; if the code is wrong, fix the code.
4. **Never** `.skip` a test without an issue link and a dated TODO.

## Documented failure patterns

Recurring or non-obvious failures get written up under `docs/solutions/test-failures/`.
Read them before digging into a familiar-smelling failure. Current entries include
`e2e-coupled-to-ui-text-after-rename.md` (text-matched Playwright assertions break after a
nav rename; only Tier 2 CI catches it) and
`jaccard-signature-collision-false-positive-guard.md`.
