---
status: complete
priority: p3
issue_id: "056"
tags:
  - cleanup
  - footer
  - accessibility
  - code-review
dependencies: []
---

# Footer Cleanup Bundle: Data Array + h3 Headings + role="list" + photoOffset

## Problem Statement

Several small cleanups from the review: footer link class repeated 9×, 3 identical column blocks, `<p>` headings should be `<h3>`, `<ul>` needs `role="list"` for Safari VoiceOver, and the gallery alt text ternary can be pre-computed.

Bundle all into one cleanup commit so the diff stays focused. (The `<h3>` and `role="list"` items are also tracked as P2 todos #052/#053 — this P3 bundles the data-array refactor work that would go alongside them.)

## Findings

**Footer class repetition:**
`text-white/60 hover:text-poster-red transition-colors no-underline` appears 9× across link `<a>` tags. Heading class appears 3×. Future link additions require manually copying class strings.

**Column markup duplication:**
3 `<div>` blocks with identical internal structure (`<p>` heading + `<ul>` + `<li>`s).

**`photoOffset` pre-compute in BlogPost gallery map:**
```astro
alt={`${title} — photo ${heroImage ? i + 2 : i + 1}`}
```
A pre-computed `const photoOffset = heroImage ? 2 : 1` makes the intent clearer:
```astro
const photoOffset = heroImage ? 2 : 1;
// ...
alt={`${title} — photo ${i + photoOffset}`}
```

**AdSlot vs AdInArticle type inconsistency:**
`AdSlot`: `slotId: string | undefined`
`AdInArticle`: `slotId?: string`
Both are semantically identical but inconsistent. Use `slotId?: string` in both.

## Proposed Solutions

### Data-array footer refactor

```astro
---
const LINK_CLS = 'text-white/60 hover:text-poster-red transition-colors no-underline';
const HEADING_CLS = 'text-white/40 uppercase tracking-widest text-xs font-medium mb-3';

const navColumns = [
  { heading: 'Browse', links: [
    { href: '/posts/', label: 'Posts' },
    { href: '/cities', label: 'Cities' },
    { href: '/map', label: 'Map' },
    { href: '/tags/cloud', label: 'Tags' },
    { href: '/cuisine', label: 'Cuisine' },
  ]},
  { heading: 'Discover', links: [
    { href: '/hitlist', label: 'Hit List' },
    { href: '/about', label: 'About' },
  ]},
  { heading: 'Info', links: [
    { href: '/rss.xml', label: 'RSS' },
    { href: '/privacy', label: 'Privacy' },
  ]},
];
---

<nav class="flex flex-wrap justify-center gap-x-16 gap-y-8 text-sm mb-8" aria-label="Footer navigation">
  {navColumns.map(({ heading, links }) => (
    <div>
      <h3 class={HEADING_CLS}>{heading}</h3>
      <ul role="list" class="space-y-2 list-none p-0 m-0">
        {links.map(({ href, label }) => (
          <li><a href={href} class={LINK_CLS}>{label}</a></li>
        ))}
        {heading === 'Info' && (
          <li>
            <button type="button" data-cc="show-preferencesModal"
              class={`${LINK_CLS} bg-transparent border-0 p-0 cursor-pointer font-[inherit] text-sm`}>
              Cookie preferences
            </button>
          </li>
        )}
      </ul>
    </div>
  ))}
</nav>
```

This bakes in the `<h3>` (P2 #052) and `role="list"` (P2 #053) fixes at the same time.

**Effort:** Small (30 min)
**Risk:** Low

## Recommended Action

Do all in one commit: `refactor(footer): data-array nav + h3 headings + list roles`. If P2 todos #052/#053 are addressed first, this todo just covers the data-array and photoOffset items.

## Acceptance Criteria

- [ ] Footer nav link class not repeated in source (extracted to `const`)
- [ ] `<h3>` heading tags on column labels
- [ ] `role="list"` on all footer `<ul>` elements
- [ ] `photoOffset` pre-computed in BlogPost gallery map
- [ ] `slotId?: string` form used consistently in both ad components
- [ ] All E2E tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by code-simplicity-reviewer and kieran-typescript-reviewer | Class repetition + semantic gaps bundle naturally with the data-array refactor |
