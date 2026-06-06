---
status: pending
priority: p3
issue_id: "057"
tags:
  - dx
  - security
  - image-pipeline
  - code-review
dependencies: []
---

# P3 Bundle: `.env.example` + `toFsPath` Edge Cases + Stale Changelog

## Problem Statement

Three small items surfaced from the review that don't warrant individual todos:

1. **No `.env.example`** — fresh-checkout contributor has no discoverable list of the 6 required `PUBLIC_*` env vars. Silent failure: ads render empty, GA4 doesn't load, and there's no error pointing to the cause.

2. **`toFsPath` edge case with `src='/'`** — `join(publicDir, '/')` resolves to `publicDir + '/'` which passes the escape check. Then `existsSync` returns true (it's a directory), `sharp` is called on a directory path, sharp throws, catch returns fallback. No security issue — just a spurious `console.warn` log. Fix: early return for `src === '/'`.

3. **`changelog.astro` stale docs** — Describes 2 ad slots but there are now 3 (top, in-article, bottom). `slot` prop name is mentioned but it's now `slotId`. Low priority since it's a changelog, not executable code.

## Proposed Solutions

### `.env.example`

Create `/.env.example` at repo root:
```
PUBLIC_GA4_ID=G-XXXXXXXXXX
PUBLIC_ADSENSE_PUB_ID=ca-pub-0000000000000000
PUBLIC_ADSENSE_SLOT_TOP=0000000000
PUBLIC_ADSENSE_SLOT_BOTTOM=0000000000
PUBLIC_ADSENSE_SLOT_INARTICLE=0000000000
```
No secrets — placeholder values only.

### `toFsPath` src='/' guard

```js
function toFsPath(src, publicDir) {
  if (!src || !src.startsWith('/') || src === '/') return null;
  const resolved = join(publicDir, src);
  if (!resolved.startsWith(publicDir + sep)) return null;
  return resolved;
}
```

One character addition to the existing guard.

### Changelog update

Update `src/pages/changelog.astro` entry for the ad slot PR to mention:
- 3 ad slots (top, in-article, bottom)
- `slotId` prop (not `slot`)
- The `slot` → `slotId` rename fix

**Effort:** XS (20 min total for all three)
**Risk:** None

## Acceptance Criteria

- [ ] `.env.example` exists at repo root with all 5 `PUBLIC_*` vars as placeholders
- [ ] `toFsPath('/', fixtureRoot)` returns null (add one test case)
- [ ] Changelog entry for ad slots is accurate

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by architecture-strategist and security-sentinel during code review | .env.example is a common fresh-clone DX gap; src='/' is harmless but noisy |
