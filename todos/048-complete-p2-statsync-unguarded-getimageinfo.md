---
status: complete
priority: p2
issue_id: "048"
tags:
  - image-pipeline
  - build
  - error-handling
  - code-review
dependencies: []
---

# Unguarded `statSync` in `getImageInfo` — Can Crash Page Render via `Promise.all`

## Problem Statement

`getImageInfo()` calls `statSync(fsPath)` to get the file's mtime for cache invalidation. If the file passes `existsSync()` but `statSync` fails (permission change mid-build, race condition on NFS), it throws synchronously inside the async function. That becomes a rejected Promise, which causes `Promise.all(galleryImages.map(...))` in `BlogPost.astro` to reject, crashing the page render for that post.

The `sharp()` call is wrapped in try/catch; `statSync` is not.

## Findings

`src/utils/image-dimensions.mjs` approximately lines 79-85:
```js
if (!existsSync(fsPath)) return fallback;
const mtime = statSync(fsPath).mtimeMs;   // ← not wrapped in try/catch
const cached = cache[src];
if (cached?.mtime === mtime) return cached;
```

`BlogPost.astro` uses:
```js
const galleryInfos = await Promise.all(galleryImages.map(img => getImageInfo(img)));
```

`Promise.all` rejects on the first rejected promise — one bad file crashes the entire gallery array for that post.

The probability is low on a stable local/Vercel build, but it is a structural gap. The `sharp` call at line 94 is correctly wrapped in try/catch; `statSync` at line 81 should have the same treatment.

## Proposed Solutions

### Option A: Wrap `statSync` in try/catch (Recommended)

```js
let mtime;
try {
  mtime = statSync(fsPath).mtimeMs;
} catch {
  return fallback;
}
```

One extra defensive branch — `getImageInfo` becomes unconditionally safe to use in `Promise.all`.

- **Effort:** XS (3 lines)
- **Risk:** None

### Option B: Use `Promise.allSettled` in `BlogPost.astro`

```js
const gallerySettled = await Promise.allSettled(galleryImages.map(img => getImageInfo(img)));
const galleryInfos = gallerySettled.map(r => r.status === 'fulfilled' ? r.value : null);
```

Prevents one failure from crashing the entire gallery. Complementary to Option A, not a replacement.

- **Effort:** XS
- **Risk:** None — already handles `null` via `info?.webp` optional chaining

## Recommended Action

Option A (fix the root cause in the utility). Option B as belt-and-suspenders if desired.

## Technical Details

**Affected file:** `src/utils/image-dimensions.mjs` — `statSync` call ~line 81

## Acceptance Criteria

- [ ] `getImageInfo('/images/test.jpg')` returns `fallback` gracefully if `statSync` throws
- [ ] `Promise.all(galleryImages.map(getImageInfo))` does not reject on a single-file error
- [ ] Existing image dimension tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by architecture-strategist during code review | `Promise.all` rejects on first failure; utility functions used in Promise.all chains must be unconditionally safe |
