---
status: pending
priority: p3
issue_id: "028"
tags:
  - code-review
  - security
  - admin-docs
dependencies: []
---

# External link uses `rel="noreferrer"` only — canonical form adds `noopener`

## Problem Statement

`tina/AdminDocs.tsx:228-235` opens an external Instagram URL in a new tab:

```tsx
<a
  style={s.link}
  href="https://www.instagram.com/accounts/access_tool/manage_data"
  target="_blank"
  rel="noreferrer"
>
  instagram.com/accounts/access_tool/manage_data
</a>
```

Modern browsers (Chrome 88+, Safari 12.1+, Firefox 79+) make
`target="_blank"` imply `rel="noopener"` automatically, and `noreferrer`
itself implies `noopener` semantically. So this is **technically safe**.

The canonical defensive form is `rel="noopener noreferrer"` for
defense-in-depth against older user agents and to make the intent
explicit at the source.

Single external link in the file; no others to fix.

## Findings

- **Sole occurrence:** `tina/AdminDocs.tsx:228-235`
- **Current value:** `rel="noreferrer"` (sufficient in modern browsers,
  redundant on `_blank`)
- **Canonical form:** `rel="noopener noreferrer"`

## Proposed Solutions

### Option A — Update to canonical form

```tsx
rel="noopener noreferrer"
```

- **Pros:** explicit intent; defense-in-depth; matches what most lint
  rules and security checklists expect.
- **Cons:** none meaningful.
- **Effort:** XS (1 min)
- **Risk:** None

### Option B — Leave as-is

- **Pros:** zero work; technically safe in modern browsers.
- **Cons:** future contributors may copy this anchor pattern into a
  context where the implicit safety doesn't hold.

## Recommended Action

(Filled during triage. Option A is trivial.)

## Technical Details

- **Affected file:** `tina/AdminDocs.tsx:228-235`

## Acceptance Criteria

- [ ] All `target="_blank"` anchors include both `noopener` and
      `noreferrer` in `rel`

## Work Log

(Empty)

## Resources

- `tina/AdminDocs.tsx:228-235`
- Finding from kieran-typescript-reviewer + security-sentinel (both P3)
