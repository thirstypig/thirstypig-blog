---
title: "YAML Round-Trip Bugs: date_added Auto-Tagged as Timestamp + atob UTF-8 Mojibake"
date: 2026-04-16
category: build-errors
tags:
  - yaml
  - astro
  - content-collection
  - zod-schema
  - tina-cms
  - github-api
  - utf-8
  - base64
  - timestamp-autotagging
  - round-trip
components_affected:
  - tina/HitListManager.tsx
  - src/data/places-hitlist.yaml
  - src/content.config.ts
status: resolved
related_prs:
  - 30
---

# YAML Round-Trip Bugs: date_added Auto-Tagged as Timestamp + atob UTF-8 Mojibake

## Problem

After the Hit List Manager (PR #27) shipped, the first two real admin commits (Kato and Hayato, via `/admin`) landed successfully on GitHub but:

1. The entries never appeared on the public `/hitlist` page.
2. Existing entries with non-ASCII characters (`Persé`, `Churrería El Moro`, `川山甲`) came back mangled as `PersÃÂ©`, `ChurrerÃÂ­a`, `Ã¥Â·ÂÃ¥Â±Â±Ã§ÂÂ²`.

No obvious error surfaced in the admin UI — the success toast fired, the commits landed on `main` — but the site was silently stuck.

## Symptoms

- GitHub commits `b111410f` and `43df6ea0` present on `main`, YAML parses as valid syntax (`npm run validate:hitlist` passes).
- Vercel deployment status: `failure`. Logs show:
  ```
  [InvalidContentEntryDataError] hitlist → miopane data does not match collection schema.
  **: [ { "expected": "string", "path": ["date_added"],
          "message": "date_added: Expected type \"string\", received \"object\"" } ]
  ```
  Note the error blames `miopane` — the *first* entry — even though Kato and Hayato were the new ones.
- Non-ASCII chars in existing entries silently corrupted with each admin commit, compounding each round-trip.

## Investigation

Steps that narrowed the root cause:

1. Compared local `main` to `origin/main` — confirmed the admin commits *did* reach GitHub; local was just stale.
2. Pulled the YAML on `main` — saw two distinct anomalies:
   - `date_added: 2026-04-15` (bare, no quotes) in every row.
   - `Persé` had become `PersÃÂ©`, `川山甲` had become `Ã¥Â·ÂÃ¥Â±Â±Ã§ÂÂ²`.
3. `npx vercel inspect <dpl_id> --logs` surfaced Astro's `InvalidContentEntryDataError` on the content-collection sync step — build failed *after* YAML syntax was valid but *during* Zod schema validation.
4. Cross-checked `src/content.config.ts:37` — `date_added: z.string()` (no `.coerce.date()`), so any non-string fails the schema.

## Root Causes

Two independent bugs in `tina/HitListManager.tsx` that only surfaced together on the first real write:

### Bug 1: `atob()` does not decode UTF-8

```ts
// BEFORE — tina/HitListManager.tsx githubGet()
const content = atob(data.content.replace(/\n/g, ""));
```

`atob` returns a Latin-1 binary string — one JS char per byte of the base64-decoded payload. For ASCII content this is indistinguishable from text, but for multi-byte UTF-8 (`é` is `0xC3 0xA9`), the in-memory string becomes the literal two-char sequence `Ã©`. When the write path re-encodes via `utf8ToBase64`, those two code points (`Ã` = U+00C3, `©` = U+00A9) each get re-encoded as UTF-8 → four bytes → next read gives `PersÃÂ©`, and it compounds.

### Bug 2: ISO-date strings round-trip into `!!timestamp`

```ts
// BEFORE — tina/HitListManager.tsx handleSubmit()
const yaml = stringify(existing, { lineWidth: 0 });
```

The `yaml` npm package (`eemeli/yaml`) uses the YAML 1.2 **core schema** by default. `stringify()` emits JS strings as **plain scalars** when they're representable unquoted. The input `"2026-04-15"` — a JS string — rendered as bare `2026-04-15`, because the library had no way to know that shape was semantically a string.

On the next parse, the core schema auto-tags `2026-04-15` as `!!timestamp` and produces a **JS `Date`**. Astro's Zod schema (`z.string()`) rejects `Date`, so the entire collection fails validation. The error mentioned `miopane` because it was the first row — *every* date in the file was poisoned, not just the new ones.

### Why this was a latent bug

The seed data written directly by hand used quoted `"2026-04-15"` strings. That file parsed fine. But the *first* write through the admin re-serialized the whole file, stripping quotes from every date. One successful admin commit → all 11 rows broken.

## Solution

Both bugs fixed in PR #30 (`tina/HitListManager.tsx`):

### Fix 1: UTF-8-safe base64 decode

```ts
function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

async function githubGet(token: string) {
  // ...
  return { content: base64ToUtf8(data.content), sha: data.sha as string };
}
```

The write side already used a correct `utf8ToBase64` helper (TextEncoder → Uint8Array → binary string → btoa). This symmetric helper closes the GET side.

### Fix 2: Force `date_added` scalars to stay quoted strings

Switched from `parse`/`stringify` to the Document API with a visitor that overrides the scalar type of every `date_added` value. This is targeted — other string fields (URLs, notes) stay plain and readable — and applied to *existing* entries too, so one bad write can't poison the file again.

```ts
import { parseDocument, visit, isScalar, isSeq, Scalar, YAMLSeq } from "yaml";

const doc = parseDocument(content);
if (!isSeq(doc.contents)) throw new Error(/* refuse to overwrite */);

// Append via the seq's add() — accepts a plain JS value at runtime
(doc.contents as YAMLSeq).add(newEntry);

// Force every date_added scalar to QUOTE_DOUBLE so YAML 1.2 can't
// auto-tag them as !!timestamp on the next parse
visit(doc, {
  Pair(_key, pair) {
    const k = isScalar(pair.key) ? pair.key.value : pair.key;
    if (k === "date_added" && isScalar(pair.value)) {
      pair.value.type = Scalar.QUOTE_DOUBLE;
    }
  },
});

const yaml = doc.toString({ lineWidth: 0 });
```

### Fix 3: Restore the YAML

Hand-rewrote `src/data/places-hitlist.yaml` using the original seed formatting (quoted dates, blank lines between entries, proper UTF-8) and added Kato and Hayato. Verified end-to-end:

- `npm run validate:hitlist` — passes.
- `npx astro build` — completes without `InvalidContentEntryDataError`; `/hitlist/index.html` and `/places-hitlist.json` emit cleanly.
- Live `https://www.thirstypig.com/places-hitlist.json` after merge — 11 entries, UTF-8 intact.

## Prevention

- **Symmetric base64 ↔ UTF-8 helpers.** If you write a `utf8ToBase64`, write its inverse in the same file and use both consistently. Any time you see `atob(...)` being used as text, it's a latent UTF-8 bug for any non-ASCII input.
- **Beware YAML 1.2 auto-tagging on round-trips.** Any string that matches a `!!timestamp`, `!!bool`, or `!!int` regex (`2026-04-15`, `yes`, `012`) will lose its string nature unless you force the scalar style. When writing YAML programmatically for a consumer with a strict string schema, either (a) use the `Document` API with per-scalar style overrides, or (b) use `defaultStringType: 'QUOTE_DOUBLE'` globally.
- **Strengthen `validate:hitlist`.** The current check only verifies YAML syntax. A schema-aware check (e.g., assert `typeof e.date_added === 'string'` for every row) would have caught this before Vercel. Consider adding a post-parse assertion in the validate script.
- **Don't trust the admin success toast without a build signal.** The Hit List Manager's commit succeeded and the UI said so — but the Vercel build silently failed. A useful follow-up would be wiring a deploy-status badge into the admin, or fetching the most recent Vercel deployment state for the committed SHA and surfacing it beside the success message.

## Related

- [`docs/solutions/feature-implementations/hitlist-manager-tinacms-github-commits.md`](../feature-implementations/hitlist-manager-tinacms-github-commits.md) — the original pattern this admin is built on. Pairs with this doc: that one is "how to build it," this one is "how the first real write can silently corrupt it."
- [`docs/solutions/build-errors/tinacms-admin-404-production.md`](./tinacms-admin-404-production.md) — prior TinaCMS + Vercel silent-build-failure incident. Same theme: the build broke in a place the admin UI didn't report.
- PR #30 — the fix.
- PRs #27, #28, #29 — shipped and polished the Hit List Manager prior to these bugs surfacing on the first real write.
