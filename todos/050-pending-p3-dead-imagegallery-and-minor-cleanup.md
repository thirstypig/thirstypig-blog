---
status: pending
priority: p3
issue_id: "050"
tags:
  - cleanup
  - dead-code
  - css
  - code-review
dependencies: []
---

# Dead Code + Minor Cleanup Bundle (Post-Gallery Refactor)

## Problem Statement

Several small inconsistencies and dead code items were left after the gallery refactor in PRs #118-123. None are bugs, but they create confusion for future editing and cargo-culting.

## Findings

**1. `ImageGallery.astro` is dead code**

`src/components/ImageGallery.astro` has zero imports anywhere in `src/`. Astro doesn't warn on unused components. It contains a thumbnail grid approach that conflicts conceptually with the current full-size inline gallery, creating a trap for any future refactor session. 67 lines of dead markup.

**2. `?? undefined` is a no-op in 4 places**

`BlogPost.astro` lines 111-112 and 134-135:
```astro
width={heroInfo.width ?? undefined}     // ← heroInfo.width is already undefined if null
height={heroInfo.height ?? undefined}   // ← same
width={info?.width ?? undefined}        // ← info?.width is undefined if info is null
height={info?.height ?? undefined}      // ← same
```
`null ?? undefined` evaluates to `undefined`. The `?? undefined` fallback is always the same as the nullish result. These are 4 no-op tokens that will be cargo-culted into future image additions.

Simplified:
```astro
width={heroInfo.width}
height={heroInfo.height}
width={info?.width}
height={info?.height}
```

**3. Dead branch in `Header.astro` `isActive`**

Line 12: `pathname === '/posts' || pathname === '/posts/'`

After `pathname = Astro.url.pathname.replace(/\/$/, '')`, `pathname` can never equal `/posts/`. The trailing-slash branch is dead.

Fix: `pathname === '/posts' || pathname.startsWith('/archive')`

**4. Stale comment in `Header.astro` line 9**

`// Desktop top bar: keep it minimal — Posts and Tags only.`

Should be: `// Desktop top bar: keep it minimal — Posts and Cities only.`

**5. Stale `ImageGallery` comments in Python scripts**

- `scripts/migrate_ig_prose.py` line 7: references `ImageGallery` as the active gallery component
- `scripts/instagram/import_instagram.py` line 426: same

Update both to say gallery images render inline in `BlogPost.astro`.

**6. No `data-testid` on gallery image wrappers**

`BlogPost.astro` gallery loop produces `<div class="post-image-wrap ...">` with no stable E2E selector hook. Future gallery tests would be forced to use brittle class selectors.

Add `data-testid="gallery-image"` (or indexed `gallery-image-0`, `gallery-image-1`) to each wrapper.

## Proposed Solutions

### Bundle all as a single cleanup PR

1. Delete `src/components/ImageGallery.astro`
2. Remove `?? undefined` from 4 attribute pairs
3. Fix dead `pathname === '/posts/'` branch
4. Fix stale "Tags" comment → "Cities"
5. Fix 2 Python script comments
6. Add `data-testid="gallery-image"` to gallery loop wrappers

All zero-risk, no behavior change.

- **Effort:** Small (20 min)
- **Risk:** None

## Recommended Action

Do all in one commit: `chore: post-gallery-refactor cleanup`. Keep the diff small and focused.

## Technical Details

**Affected files:**
- `src/components/ImageGallery.astro` (delete)
- `src/layouts/BlogPost.astro` lines 111-112, 128, 134-135
- `src/components/Header.astro` lines 9, 12
- `scripts/migrate_ig_prose.py` line 7
- `scripts/instagram/import_instagram.py` line 426

## Acceptance Criteria

- [ ] `ImageGallery.astro` deleted
- [ ] `?? undefined` removed from all 4 width/height attrs
- [ ] `pathname === '/posts/'` dead branch removed
- [ ] Header comment updated to "Posts and Cities"
- [ ] Two Python script comments updated
- [ ] `data-testid="gallery-image"` added to gallery wrappers
- [ ] `npm run typecheck` passes
- [ ] Pre-commit tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by code-simplicity-reviewer and agent-native-reviewer during code review | Dead components are invisible to Astro build warnings; manual audit needed |
