---
status: complete
priority: p2
issue_id: "046"
tags:
  - security
  - image-pipeline
  - build-time
  - code-review
dependencies: []
---

# Path Traversal: `toFsPath` in `image-dimensions.mjs` Missing Containment Check

## Problem Statement

`getImageInfo()` guards against non-`/`-prefixed paths but does not verify the resolved path stays within `public/`. `node:path.join()` normalizes sequences like `/../../../etc/passwd` into a valid escape path. A markdown file with crafted frontmatter could cause `sharp` to attempt reading arbitrary files from the build environment.

**Severity note:** Build-time only, single author, content is author-controlled. Real-world exploitability is near-zero. Still worth fixing as defense-in-depth.

## Findings

In `src/utils/image-dimensions.mjs`:

```js
function toFsPath(src, publicDir) {
  if (!src || !src.startsWith('/')) return null;
  const fsPath = join(publicDir, src);  // ← no escape check after join()
  return fsPath;
}
```

`join('/Users/.../public', '/../../../etc/passwd')` → `/etc/passwd` on POSIX.

`existsSync('/etc/passwd')` returns `true` on a Linux/macOS build runner. `sharp('/etc/passwd')` then fails (not an image), but the `console.warn` echoes the path into Vercel build logs.

The `content.config.ts` schema validates `images` as `z.array(z.string())` with no path constraint — unlike `placeId` which enforces `/^0x[0-9a-f]+:0x[0-9a-f]+$/`.

## Proposed Solutions

### Option A: Add escape-check in `toFsPath` (Recommended)

```js
import { sep } from 'node:path';

function toFsPath(src, publicDir) {
  if (!src || !src.startsWith('/')) return null;
  const resolved = join(publicDir, src);
  if (!resolved.startsWith(publicDir + sep)) return null;  // escape check
  return resolved;
}
```

Five-line change. Zero breakage risk — all valid image paths (`/images/posts/...`) resolve inside `public/`.

- **Effort:** XS
- **Risk:** None

### Option B: Schema constraint on `images` and `heroImage` fields

In `content.config.ts`:
```ts
heroImage: z.string().regex(/^\/images\//).optional(),
images: z.array(z.string().regex(/^\/images\//)).default([]),
```

Prevents traversal at the content-validation layer. Complementary to Option A, not a replacement.

- **Effort:** XS
- **Risk:** Would reject any image not under `/images/` — check that all posts comply first

## Recommended Action

Option A immediately (single function, no side effects). Option B as follow-up if you want belt-and-suspenders.

## Technical Details

**Affected file:** `src/utils/image-dimensions.mjs` — `toFsPath` function

## Acceptance Criteria

- [ ] `toFsPath('/../../etc/passwd', PUBLIC_DIR)` returns `null`
- [ ] `toFsPath('/images/posts/foo.jpg', PUBLIC_DIR)` still returns the correct path
- [ ] Existing image tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by security-sentinel during code review | `node:path.join` normalizes traversal sequences; `startsWith('/')` alone is not sufficient |
