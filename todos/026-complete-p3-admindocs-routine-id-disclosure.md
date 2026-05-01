---
status: pending
priority: p3
issue_id: "026"
tags:
  - code-review
  - security
  - admin-docs
dependencies: []
---

# Routine ID `trig_01N3hRwVf9FxvFPiDigDBPyo` exposed in admin docs

## Problem Statement

`tina/AdminDocs.tsx:272` references the IG-reminder routine by full ID:

```tsx
<code style={s.code}>
  claude.ai/code/routines/trig_01N3hRwVf9FxvFPiDigDBPyo
</code>
```

Anthropic Cloud routine IDs are owner-scoped resource identifiers, not
bearer secrets — an attacker holding the ID still needs an authenticated
session for the routine's owner to view or modify it. Treat as
low-sensitivity metadata, similar to a GitHub repo ID.

The risk surface is **future content migration**: if any of this admin
screen content gets copied into a public `/changelog` post, blog post, or
public docs site, the routine ID leaks publicly. Low cost to redact now;
removes the temptation entirely.

## Findings

- **Sole occurrence:** `tina/AdminDocs.tsx:272`
- **Sensitivity:** Owner-scoped, not a bearer secret. Cannot be used to
  read or trigger the routine without auth.
- **Risk vector:** Future copy-paste into public surface.

## Proposed Solutions

### Option A — Replace with a generic phrase

```tsx
<code style={s.code}>
  the IG-reminder routine in claude.ai/code → Routines
</code>
```

- **Pros:** removes the literal; reader can still find it; zero
  functionality impact.
- **Cons:** marginally less convenient (no click-to-copy URL fragment).
- **Effort:** XS (1 min)
- **Risk:** None

### Option B — Leave as-is

- **Pros:** zero work
- **Cons:** retains the temptation
- **Effort:** None
- **Risk:** Low (admin-gated; not currently public)

## Recommended Action

(Filled during triage. Option A is cheap.)

## Technical Details

- **Affected file:** `tina/AdminDocs.tsx:272`

## Acceptance Criteria

- [ ] No literal `trig_*` ID in `tina/AdminDocs.tsx`
- [ ] Reader can still locate the routine via the rephrased prose

## Work Log

(Empty)

## Resources

- `tina/AdminDocs.tsx:272`
- Finding from security-sentinel (P3)
