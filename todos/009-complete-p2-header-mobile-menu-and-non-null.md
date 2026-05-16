---
status: pending
priority: p2
issue_id: "009"
tags:
  - code-review
  - quality
  - accessibility
  - typescript
dependencies: []
---

# Header.astro: mobile-menu logic inverted + non-null assertions

## Problem Statement

Two small but real JS bugs in `src/components/Header.astro` from this session's redesign.

**1. Mobile menu toggle uses pre-toggle state for `aria-expanded`** (lines 113-115):

```ts
const isOpen = !menu?.classList.contains('hidden');  // current state
menu?.classList.toggle('hidden');
menuBtn.setAttribute('aria-expanded', String(!isOpen));
```

`isOpen` is computed *before* the toggle. The variable name says "is open" but it's actually "was open before this click." It happens to land correct because `aria-expanded` is set to `!isOpen` (= `!wasOpen` = "isn't open anymore" = "is now open"). A future maintainer reading `String(!isOpen)` will "fix" it to `String(isOpen)` and break the accessibility contract.

**2. Non-null assertions on `getElementById`** (lines 119, 120):

```ts
document.getElementById('theme-icon-sun')!.classList.toggle('hidden', !isDark);
document.getElementById('theme-icon-moon')!.classList.toggle('hidden', isDark);
```

If either icon is ever renamed/removed, this throws at runtime. Four lines down, the same file uses optional chaining (`themeBtn?.setAttribute`) — inconsistent style and the safer pattern.

## Findings

- `src/components/Header.astro:113-115` — pre-toggle state used for post-toggle aria
- `src/components/Header.astro:119-120` — `!` non-null assertions
- Discovered by kieran-typescript-reviewer during /ce:review

## Proposed Solutions

### Option A: Toggle first, read state after; replace `!` with optional chaining

```ts
menu?.classList.toggle('hidden');
const isOpen = !menu?.classList.contains('hidden');
menuBtn.setAttribute('aria-expanded', String(isOpen));

// And:
document.getElementById('theme-icon-sun')?.classList.toggle('hidden', !isDark);
document.getElementById('theme-icon-moon')?.classList.toggle('hidden', isDark);
```

- Pros: variable name matches state; consistent style throughout file; no runtime crashes
- Cons: none — strictly better
- Effort: Small (5 minutes)
- Risk: Low

### Option B: Rename `isOpen` → `wasOpen` for honesty, leave `!` assertions

- Pros: fastest
- Cons: doesn't fix the runtime risk on icon lookups
- Effort: Trivial
- Risk: Low

## Recommended Action

_To be filled during triage. Option A is recommended._

## Technical Details

Affected files: `src/components/Header.astro`

## Acceptance Criteria

- [ ] No `!` non-null assertions in Header.astro client script
- [ ] Mobile menu's `aria-expanded` reflects post-toggle state (verify with screen reader or DevTools)
- [ ] Theme toggle still works after icon node lookup pattern change

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Identified during /ce:review | The Header was preserved-then-modified during the Bold Red Poster redesign; the original toggle logic carried over and now reads as suspicious even though it works. |

## Resources

- `src/components/Header.astro`
