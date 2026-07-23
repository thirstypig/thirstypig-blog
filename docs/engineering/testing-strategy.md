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

> **⚠️ The real testing doc is `docs/testing.md`** — 311 lines covering the two test
> kinds, how to run them, the three-tier cadence, current coverage, how to add a test, and
> documented failure patterns. **It was not moved or copied here.**
>
> **Decision needed (james):** either relocate `docs/testing.md` → this path and delete
> this pointer, or keep it where it is and leave this file as the index. Relocating is a
> file move, so it needs an explicit OK. Until then this page holds only what
> `testing.md` does *not* cover.

---

## What we test — the shape

| Tier | Tool | Count | Runs |
|---|---|---|---|
| Typecheck | `tsc --noEmit` | — | ~14s, 4 GB heap |
| JS/TS unit | Vitest | **11 files** | milliseconds |
| Python unit | pytest | **28 files** | fast |
| E2E | Playwright | **14 specs** | ~1s per test, real browser |

`npm test` runs all four in order.

## Ugly cases — the list to fill

The failure modes that have actually bitten this project, and whether anything guards them
today. This is the section `testing.md` doesn't have: not "what do we test" but "what has
hurt us, and is it covered now?"

| # | Ugly case | Guarded today? |
|---|---|---|
| U1 | **Silent-success pipeline steps** — a script runs clean and produces zero output | ❌ Only by hand. The recurring lesson is *count assertions*, applied inconsistently. |
| U2 | **Cross-parser strictness** — PyYAML accepts what js-yaml rejects (duplicate keys) | ✅ `test_venues_yaml_no_duplicate_keys.py` |
| U3 | **YAML type coercion** — bare dates become Date objects; UTF-8 corrupts through `atob` | ⚠️ Partial. Encoding is centralized in `github-contents.ts` but has no test. |
| U4 | **Geocoding autofill contamination** — a confident wrong-business match writes name, address, coords, and place_id together | ❌ No automated guard. Caught by eye. |
| U5 | **Docs pointing at deleted files** — `components:` frontmatter naming retired code (e.g. `ImageGallery.astro`) | ❌ Nothing validates those paths. Cheap to add to `docs:refresh`. |
| U6 | **Silent render-nothing** — `venue-tags.ts` returns `null` on unreadable JSON; the page renders empty with a green build | ❌ **No test file at all.** See TD-005. |
| U7 | **E2E coupled to UI text** — a copy rename breaks specs, and only on Tier 2 CI | ✅ Documented in a solution doc; run `npm run test:e2e` locally before visual PRs. |
| U8 | **Build-time endpoint shape drift** — `/places-hitlist.json` is consumed by another codebase | ❌ No contract test. A field rename breaks jameschang.co with no local error. |

<!-- TODO(james): add any I've missed. The test is "has this cost me an evening?" -->

## Gaps worth closing, ranked

1. **U6** — one test file, removes a silent-failure path on every venue page (TD-005).
2. **U8** — a shape assertion on `/places-hitlist.json`; it's the only cross-repo contract.
3. **U5** — a `docs:refresh` check that every `components:` path still exists.

## Docs-system tests

Spec item #6 calls for unit tests on the doc viewer itself: **title extraction**,
**code-fence guard**, **section grouping**, **exclusions**.

**This is not hypothetical — `docs/testing.md` is a live trap.** It contains bash blocks
whose comment lines start with `# `:

```
# Typecheck everything (src/, tina/, scripts/*.mjs) — ~14s with 4GB heap
```

A naive H1 scan finds **six** `# ` lines in that file. Only the first is a real heading.
Any parser that doesn't strip fenced blocks before matching will eventually title a doc
"Typecheck everything". The guard is `raw.replace(/```[\s\S]*?```/g, "")` before matching.

<!-- Prompt-to-self: when the refresh script lands in Step 6, write these four tests -->
<!-- against docs/testing.md specifically — it's the adversarial fixture we already have. -->
