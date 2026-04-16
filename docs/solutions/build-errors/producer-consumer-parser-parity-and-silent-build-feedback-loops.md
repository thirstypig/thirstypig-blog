---
title: "Parser Parity and Closing Silent-Failure Feedback Loops Between Admin Writes and Build-Time Schema Validation"
date: 2026-04-16
category: build-errors
tags:
  - yaml
  - js-yaml
  - parser-parity
  - validation
  - astro
  - content-collection
  - tina-cms
  - github-api
  - silent-failure
  - feedback-loop
  - vercel
components_affected:
  - scripts/validate_hitlist.mjs
  - tina/HitListManager.tsx
  - package.json
status: resolved
related_prs:
  - 30
  - 32
---

# Parser Parity and Closing Silent-Failure Feedback Loops Between Admin Writes and Build-Time Schema Validation

This doc captures two reusable patterns surfaced while hardening the Hit List admin after PR #30's bugs. They generalize beyond the Hit List — they apply to any static-site admin tool that writes structured data that a build-time schema then reads.

The bugs themselves are documented in [`yaml-round-trip-timestamp-and-utf8-corruption.md`](./yaml-round-trip-timestamp-and-utf8-corruption.md). That doc is "what broke and why." This one is "what to keep doing so it doesn't break again the next time."

## Problem

After PR #30 fixed two round-trip bugs in `tina/HitListManager.tsx`, the PR review surfaced a deeper pattern: **the feedback loop between admin action and public outcome was open**. Specifically:

1. **The validator didn't actually validate.** The pre-build `validate:hitlist` check parsed the YAML and said "valid" — but used a *different YAML parser* than the one Astro's content-collection loader uses. The two parsers disagreed on bare ISO dates, so the validator passed files that Astro then rejected.
2. **The admin UI claimed success on any successful GitHub commit**, even when the Vercel build that the commit triggered failed. The only signal that something went wrong was "the entry doesn't appear on the site" — which you only notice by going and checking, hours later.

Both failure modes shared a common shape: **a check existed, but was checking the wrong thing**. The fix is two patterns that close each gap.

## Pattern 1 — Parser Parity in Cross-Boundary Validators

### The rule

When you write a validator (or a test, or a schema check) for data that crosses a serialization boundary, **use the parser the consumer uses, not the one the producer uses**. Two libraries that both claim to implement "YAML" or "JSON" or "TOML" can silently disagree on edge cases, and the only parser that matters for correctness is the one that will actually read the file in production.

### The concrete instance

This repo has two YAML parsers in dependency closure:

| Package | YAML spec | `2026-04-16` parses as |
|---|---|---|
| `yaml` v2.5.x (used by `tina/HitListManager.tsx` on the write side) | YAML 1.2, core schema | `string` — core schema omits `!!timestamp` |
| `js-yaml` v4.x (used by Astro's `file()` loader — `node_modules/astro/dist/content/loaders/file.js:3`) | YAML 1.1 | `Date` — 1.1 schema includes `!!timestamp` |

Initial draft of `scripts/validate_hitlist.mjs` imported `parse` from the `yaml` package because that's what the admin already imports. The validator said "valid" for a file with bare `date_added: 2026-04-16`, and Astro then rejected the same file at build time with `InvalidContentEntryDataError`.

### The fix

Use the consumer's parser:

```js
// scripts/validate_hitlist.mjs
// Uses js-yaml because Astro's file() loader uses js-yaml (YAML 1.1 semantics).
// The yaml npm package (YAML 1.2 core) and js-yaml disagree on bare ISO dates:
// js-yaml parses `2026-04-16` as a Date via !!timestamp; yaml v2 keeps it as a
// string. If this validator used the yaml package, it would pass files that
// then fail Astro's schema — exactly the bug class it's meant to catch.

import yaml from "js-yaml";
const data = yaml.load(raw);
```

The confirmation that this change matters: the same file that passes `validate:hitlist` under `yaml` fails it under `js-yaml`, matching Astro's production behavior. Verified by running the validator on a handcrafted bad file.

### How to apply this pattern elsewhere

- **Any Markdown frontmatter validator** in this repo must use the same YAML parser Astro uses (`js-yaml`), not a separately-installed one.
- **Any JSON Schema validator** checking files that `JSON.parse` will read should use `JSON.parse` — not a stricter library like `Ajv`'s internal parser — since Node's `JSON.parse` has its own specific quirks (e.g., prototype pollution from `__proto__`).
- **Any TOML, INI, or other config validator** — check which parser the framework uses (Astro uses `smol-toml` per `file.js:4`), and use it.
- **Generalizing to non-parser boundaries**: any test that serializes test data and feeds it to production code should use production's deserializer path, not the test framework's shortcut.

## Pattern 2 — Closing Silent-Failure Feedback Loops With a Delayed Live-Check

### The rule

When a user action in an admin commits to a pipeline (GitHub → CI → build → deploy), **the admin UI should report the *outcome* of the full pipeline, not just the first step**. Otherwise the user gets a false green light and discovers the failure only by checking the public site hours later.

### The concrete instance

`HitListManager.tsx` calls GitHub's PUT contents endpoint. On 200 OK, it showed a success banner reading "saved to hit list — will appear on /hitlist in about a minute." But:

- GitHub PUT success only means the commit landed on `main`.
- Vercel's rebuild might fail (as it did for the two admin commits in PR #30's origin incident).
- The admin has no way to know about that failure.
- The user's only signal is "oh, my entry isn't on the site" — sometimes noticed hours or days later.

The `validate:hitlist` step catches *a subset* of this failure class pre-commit (see Pattern 1). But any failure that happens *after* the validator — a Vercel env var change, a dependency update, a new schema error — still has no signal back to the admin.

### The fix

Instead of trusting the intermediate success (GitHub 200) as the final signal, poll the public endpoint for the expected change:

```tsx
// tina/HitListManager.tsx (simplified)
function scheduleLiveCheck(id: string, name: string) {
  // Clear any pending check so a second submit cancels a stale one
  if (liveCheckRef.current?.timer) clearTimeout(liveCheckRef.current.timer);

  const timer = setTimeout(async () => {
    if (liveCheckRef.current?.id !== id) return; // stale
    const resp = await fetch(`/places-hitlist.json?_=${Date.now()}`);
    const data = await resp.json();
    const live = data.items?.some((i: { id?: unknown }) => i?.id === id);
    setMessage(
      live
        ? { type: "success", text: `✓ "${name}" is now live on /hitlist.` }
        : { type: "info", text: `Saved "${name}" but not yet live — check the Vercel dashboard if it doesn't appear soon.` }
    );
  }, 75_000); // past Vercel's typical rebuild time

  liveCheckRef.current = { id, timer };
}
```

Three properties to preserve when applying this pattern:

1. **Cache-buster on the check.** The public endpoint has `s-maxage=86400` CDN caching (see `vercel.json`), so appending a `?_=<timestamp>` query parameter is required to bypass the cache and see freshly-deployed data.
2. **Concurrent-submit safety.** A `useRef<{id, timer}>` (not a state variable — we don't want re-renders to race) tracks the most recent pending check. A second submit clears the earlier timer. Stale callbacks check `liveCheckRef.current?.id !== id` and return early.
3. **Unmount cleanup.** The `useEffect` cleanup must `clearTimeout(liveCheckRef.current?.timer)` to avoid setting state on an unmounted component.

### Design tradeoffs to consider when applying

- **Polling vs. single-shot.** PR #32 uses a single 75-second-delayed check, not a polling loop. A single check is simpler and accurate for Vercel's typical rebuild timeline; polling would give finer-grained feedback but doubles the complexity (interval, backoff, max-attempts). For a personal admin used a few times a week, single-shot is the right call. For a tool used hourly, polling might pay for itself.
- **What counts as "live."** This implementation checks "the expected id appears in `/places-hitlist.json`". That's specific to this feature's shape. For a different content type (e.g., a markdown post), you'd check the post's slug page returns 200 and the title matches.
- **Build-failure specificity.** A missing entry after 75s could mean (a) build failed, (b) build is slow, (c) CDN caching. This implementation can't distinguish them without a second signal. A future enhancement: fetch the GitHub commit's check-runs state (requires a separate PAT scope) to distinguish "still building" from "build failed." Deferred for now — the current banner at least correctly tells the user to go look at Vercel.

### How to apply this pattern elsewhere

- **Any admin form that commits to a static-site build pipeline** — confirm the public artifact after the expected rebuild window.
- **Any webhook-triggered background job** (background enqueue → worker → DB write) — confirm the DB write, not just the enqueue.
- **Any async UI action that triggers a non-trivial backend chain** — don't rely on the first-step success toast as the UX signal; poll or push for the terminal state.

## Prevention — a checklist for the next admin tool

When wiring up a new admin/editor surface that commits to this repo:

1. ☐ Pre-commit validator runs in `package.json` build step. Uses the **consumer's** parser, not the producer's.
2. ☐ Validator checks field types, not just syntax (a Zod-style schema check is ideal).
3. ☐ Post-commit UI schedules a single `setTimeout` check of the public artifact with a cache-buster.
4. ☐ Check uses a `useRef` guard so concurrent submits don't produce stale banners.
5. ☐ `useEffect` cleanup clears the pending timer on unmount.
6. ☐ Credentials (PATs, etc.) in `sessionStorage` not `localStorage`.
7. ☐ Error throws use `resp.statusText` (predictable) not `await resp.text()` (arbitrary server body in UI strings).

## Related

- [`docs/solutions/build-errors/yaml-round-trip-timestamp-and-utf8-corruption.md`](./yaml-round-trip-timestamp-and-utf8-corruption.md) — The origin incident this hardening prevents. Required context for "why these patterns exist."
- [`docs/solutions/feature-implementations/hitlist-manager-tinacms-github-commits.md`](../feature-implementations/hitlist-manager-tinacms-github-commits.md) — The pattern doc for the admin itself. Pairs with this one: that's "how to build the admin," this is "how to keep it from lying about success."
- [`docs/solutions/build-errors/tinacms-admin-404-production.md`](./tinacms-admin-404-production.md) — Prior silent-build-failure incident (build swallowed `|| true`). Same theme, different mechanism.
- PRs #27, #28, #29 — original shipping of the Hit List admin.
- PR #30 — fixed the two round-trip bugs (UTF-8 mojibake, bare-date timestamp auto-tagging).
- PR #32 — implemented the two patterns in this doc: parser-parity validator + post-commit live-check + supporting hardening (`sessionStorage`, `resp.statusText`).
