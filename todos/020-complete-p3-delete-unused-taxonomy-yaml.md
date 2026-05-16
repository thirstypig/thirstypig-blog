---
status: pending
priority: p3
issue_id: "020"
tags:
  - code-review
  - simplification
  - venue-tags
dependencies: []
---

# Delete unused `scripts/venue-tags/taxonomy.yaml`

## Problem Statement

`scripts/venue-tags/taxonomy.yaml` (161 lines) was created during the venue-tags MVP scaffolding for a curated-keyword tag classification approach. The pipeline pivoted to scraping Google's pre-computed chip widget instead, abandoning the taxonomy approach.

The README itself acknowledges the file is dead:

> "kept for now, but largely unused given the pivot below" (line 15)
> "may revisit if we ever want to map chips into a normalized category set" (line 148)

After 12+ session hours, nothing in `scripts/` or `src/` references it. Pure speculation, 0 usage.

## Findings

- **Lines deleted:** 161
- **References found:** 0 (grep across entire repo)
- **Reason kept so far:** "might revisit"
- **Reality:** git history preserves it if we ever need it back

## Proposed Solutions

### Option A — Delete the file

```bash
git rm scripts/venue-tags/taxonomy.yaml
```

Update `scripts/venue-tags/README.md` to remove the references at lines 15 and 148.

- **Pros:** removes dead code; simplifies the directory; honest signal about pipeline direction
- **Cons:** if someone wants the taxonomy structure back, they have to git log
- **Effort:** Tiny
- **Risk:** None

### Option B — Keep it

- **Pros:** zero work
- **Cons:** dead code; misleads new readers about what the pipeline does
- **Effort:** None
- **Risk:** None

## Recommended Action

(Filled during triage — Option A.)

## Technical Details

- **Affected files:** `scripts/venue-tags/taxonomy.yaml` (delete), `scripts/venue-tags/README.md` (update references)

## Acceptance Criteria

- [ ] File removed from working tree and git
- [ ] README references at lines 15 and 148 updated or removed
- [ ] No build/test regression

## Work Log

(Empty)

## Resources

- `scripts/venue-tags/taxonomy.yaml`
- `scripts/venue-tags/README.md:15,148`
