---
status: pending
priority: p2
issue_id: "015"
tags:
  - code-review
  - security
  - venue-tags
dependencies: []
---

# Latent `</script>` injection risk in TagGraph data blob

## Problem Statement

`src/components/TagGraph.astro:101` inlines chip data into a `<script type="application/json">` block via `set:html={JSON.stringify(graphData)}`. `JSON.stringify` does **not** escape `<`, `>`, or `</script`, so a chip label containing `</script>` (or `<!--`, `<script`) would close the JSON-data block early and let arbitrary HTML/JS following it land in the DOM.

The same pattern exists in `src/components/SEO.astro:135,140,145,150` for JSON-LD blocks built from frontmatter.

## Findings

- File: `src/components/TagGraph.astro:101`
  ```astro
  <script type="application/json" id="chip-graph-data" set:html={JSON.stringify(graphData)} />
  ```
- Chip labels flow in via `nodeMap.set(c.label, ...)` at `TagGraph.astro:58` with no escaping or filtering. They originate from `aria-label` regex matches in `scrape_google.py:90`.
- **Not exploitable today** — current chip labels are clean Google review phrases. Google sanitizes chip labels heavily.
- **Worth fixing because** the venue-tags pipeline is designed to grow and labels are not validated for HTML metacharacters anywhere between scrape → publish → render.
- Same pattern at `src/components/SEO.astro:135,140,145,150` for post-frontmatter JSON-LD. Lower likelihood (frontmatter is author-controlled) but identical vector.

## Proposed Solutions

**A. Escape `<` in JSON output** (one-line fix)
```js
set:html={JSON.stringify(graphData).replace(/</g, '\\u003c')}
```
- Pros: minimal change, no architecture impact, applies to both TagGraph and SEO
- Cons: easy to forget on next inlined-JSON addition
- Effort: Small
- Risk: Low

**B. Move data to fetched JSON endpoint** (mirror search.json pattern)
- Add `src/pages/tag-graph.json.ts` that returns `graphData`. Client `fetch('/tag-graph.json')` on mount.
- Pros: removes inline-JSON pattern entirely, eliminates the entire class of bug
- Cons: extra HTTP roundtrip, slightly slower TTI for the graph
- Effort: Medium
- Risk: Low

## Recommended Action

(Filled during triage)

## Technical Details

- `src/components/TagGraph.astro:101` — primary site
- `src/components/SEO.astro:135,140,145,150` — same pattern, lower priority
- No DB changes

## Acceptance Criteria

- [ ] Chip label `<script>alert(1)</script>` in a published JSON does not execute on `/map`, `/tags/graph`, or any post page rendering chips
- [ ] Existing TagGraph rendering still works (visual check on `/map`)
- [ ] Same fix applied to SEO.astro JSON-LD blocks (or rationale documented)

## Work Log

(Empty)

## Resources

- PR: #94
- File-todos skill: `.claude/skills/file-todos/`
- Astro docs on `set:html`: https://docs.astro.build/en/reference/directives-reference/#sethtml
