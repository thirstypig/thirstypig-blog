---
status: pending
priority: p2
issue_id: "025"
tags:
  - code-review
  - accessibility
  - admin-docs
dependencies: []
---

# Sidebar nav buttons missing `type="button"`, `aria-current`, and use wrong landmark

## Problem Statement

`tina/AdminDocs.tsx:660-669` renders the section switcher as plain
`<button>` elements inside `<nav>`:

```tsx
<nav style={s.sidebar}>
  ...
  {SECTIONS.map((sec) => (
    <button
      key={sec.id}
      style={s.navItem(active === sec.id)}
      onClick={() => setActive(sec.id)}
    >
      <span style={{ marginRight: 8 }}>{sec.emoji}</span>
      {sec.label}
    </button>
  ))}
</nav>
```

Three accessibility issues:

1. **Missing `type="button"`.** Default `<button>` type is `submit` — if
   this component is ever wrapped in a form (TinaCMS admin shells often
   are), a click will submit the form. Defensive default.
2. **No `aria-current` or `aria-pressed`.** Screen readers can't tell which
   section is active. Visual cue (left border + bold weight) is
   sighted-only.
3. **Wrong landmark.** `<nav>` is for navigating between pages/views (anchor
   links to other URLs). For an in-page tablist (mutually-exclusive section
   selection that doesn't change the URL), the correct shape is
   `role="tablist"` with `role="tab"` children.

Sibling admin screens (`tina/PostManager.tsx`, `tina/StyleSheet.tsx`,
etc.) don't have a section-switcher pattern, so this is the first one in
the directory — worth getting right because it'll get copied.

## Findings

- **`type="button"` missing:** `tina/AdminDocs.tsx:661-668`
- **`aria-pressed` / `aria-current` missing:** same lines
- **`<nav>` landmark mismatch:** `tina/AdminDocs.tsx:658`

## Proposed Solutions

### Option A — Minimal a11y patch (recommended)

```tsx
<aside style={s.sidebar} role="tablist" aria-label="Documentation sections">
  <div style={s.sidebarTitle}>Docs</div>
  {SECTIONS.map((sec) => (
    <button
      key={sec.id}
      type="button"
      role="tab"
      aria-selected={active === sec.id}
      aria-controls={`docs-panel-${sec.id}`}
      style={s.navItem(active === sec.id)}
      onClick={() => setActive(sec.id)}
    >
      <span style={{ marginRight: 8 }}>{sec.emoji}</span>
      {sec.label}
    </button>
  ))}
</aside>
```

Plus add `id={`docs-panel-${active}`} role="tabpanel"` to the `<main>`.

- **Pros:** correct landmark; screen readers announce active section;
  defensive `type="button"`; small diff.
- **Cons:** introduces ARIA you have to maintain; for a single-operator
  admin tool, possibly over-spec'd.
- **Effort:** Small (15 min)
- **Risk:** None

### Option B — Just `type="button"` + `aria-current="page"`

Skip the `role="tablist"` upgrade. Add `type="button"` and
`aria-current="page"` (which siblings use elsewhere for nav links).

- **Pros:** fixes the form-submit footgun and the most-noticeable screen
  reader gap; smallest diff.
- **Cons:** still mislabels the landmark; still calls section switching
  "navigation" when it isn't.
- **Effort:** XS (5 min)
- **Risk:** None

### Option C — Skip; admin is single-user and not screen-reader audience

- **Pros:** zero work
- **Cons:** the `type="button"` footgun is real even for sighted users;
  cheap to fix; sets a poor precedent for future admin screens
- **Effort:** None
- **Risk:** Low (form-submit footgun if future TinaCMS shell wraps screens)

## Recommended Action

(Filled during triage. Option A if we want it right; Option B if we want
it cheap.)

## Technical Details

- **Affected file:** `tina/AdminDocs.tsx:658-670`

## Acceptance Criteria

- [ ] All buttons have `type="button"`
- [ ] Active state is announced to screen readers (via `aria-selected` or
      `aria-current` or `aria-pressed`)
- [ ] Landmark is correct (`role="tablist"` or no landmark, not `<nav>`)

## Work Log

(Empty)

## Resources

- `tina/AdminDocs.tsx:658-670`
- WAI-ARIA tablist pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- Finding from kieran-typescript-reviewer (P2)
