---
status: pending
priority: p2
issue_id: "018"
tags:
  - code-review
  - documentation
  - venue-tags
  - agent-native
dependencies: []
---

# Document the public venue-tags JSON schema

## Problem Statement

`public/venue-tags/{place_id}.json` is the consumer-facing artifact of the venue-tags pipeline. The actual shape is declared in `scripts/venue-tags/publish.py` but lives only in code:

```python
PASSTHROUGH_FIELDS = ("place_id", "venue_name", "chips", "scraped_at")
# plus city + key augment
```

A consumer (tastemakers-iOS, an MCP server, another agent, another developer) has to read Python source to learn the contract. The README at `scripts/venue-tags/README.md:117-131` documents the **internal `data/{key}_chips.json`** shape — which is *different* (has `query`, `final_url`, `tab_labels`; lacks `city`).

The user's stated goal is cross-project reuse. The undocumented schema is the single biggest blocker for that.

## Findings

**Current public JSON shape (from inspecting `publish.py:31,55-57` and a published file):**

```json
{
  "place_id": "0x80c2b8d33ce3dcc9:0xb0a9252822b856f6",
  "venue_name": "Petit Trois",
  "chips": [
    {"label": "escargot", "mention_count": 43},
    {"label": "french onion soup", "mention_count": 38}
  ],
  "scraped_at": "2026-04-29T17:42:18Z",
  "city": "Los Angeles",
  "key": "petit-trois-la"
}
```

Notable gotchas not documented anywhere:
- `place_id` contains `:` — URL portability hazard (some clients encode it differently)
- `scraped_at` format is `%Y-%m-%dT%H:%M:%SZ` UTC — stable but undocumented
- `chips` is sorted by Google's render order (mention count desc), but consumers shouldn't trust the sort
- `city` and `key` are augmented from `venues.yaml` — if a published JSON exists but its venues.yaml entry was deleted, those fields would go missing on next publish

## Proposed Solutions

### Option A — `public/venue-tags/SCHEMA.md` (markdown doc)

Write a markdown file in the same dir explaining each field, with examples, constraints, and the URL caveats.

- **Pros:** human-readable; lives next to the data; easy to update
- **Cons:** not machine-checkable
- **Effort:** Small
- **Risk:** None

### Option B — JSON Schema file at `public/venue-tags/schema.json`

Formal JSON Schema (Draft 7+) describing the shape. Consumers can validate.

- **Pros:** machine-checkable; auto-doc generation; ecosystem support
- **Cons:** more verbose; nobody on this project will run a validator
- **Effort:** Small
- **Risk:** None

### Option C — both A and B

Markdown for humans, JSON Schema for tooling. Link from `scripts/venue-tags/README.md`.

- **Pros:** best of both
- **Cons:** marginal extra work
- **Effort:** Small
- **Risk:** None

## Recommended Action

(Filled during triage — leaning Option C if cross-project consumers are real, otherwise Option A.)

## Technical Details

- **Affected files:**
  - `public/venue-tags/SCHEMA.md` (new)
  - `public/venue-tags/schema.json` (optional, new)
  - `scripts/venue-tags/README.md` (link to schema)

## Acceptance Criteria

- [ ] Schema doc lists all 6 fields (place_id, venue_name, chips, scraped_at, city, key) with types, constraints, and one-line description
- [ ] URL caveats noted (`:` in filename)
- [ ] `chips[]` sub-shape documented
- [ ] Linked from README

## Work Log

(Empty)

## Resources

- `scripts/venue-tags/publish.py:31,55-57` — current implicit schema
- `scripts/venue-tags/README.md:117-131` — internal-data schema (different)
