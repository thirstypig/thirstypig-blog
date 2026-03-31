---
status: pending
priority: p3
issue_id: "003"
tags:
  - enrichment
  - claude-api
  - content
  - code-review
dependencies: []
---

# Finish Phase 2 Enrichment for Remaining 820 Posts

## Problem Statement

The batch enrichment script completed Phase 2 (Claude Haiku cuisine/dish classification) on 1,300 of 2,120 posts before the API key was disabled. 820 posts remain without cuisine tags or dish tags.

## Proposed Solutions

### Option A: Resume with fresh API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
python3 scripts/enrich_posts.py --phase2-only --resume
```

- **Pros:** Completes the enrichment, ~$0.30 remaining cost, ~2 min runtime
- **Cons:** Needs fresh API key
- **Effort:** Small (5 minutes)
- **Risk:** Low

### Option B: Use ThreadPoolExecutor for speed

Add concurrent API calls (8 workers) to cut runtime from ~2 min to ~20 seconds.

- **Pros:** Faster
- **Cons:** More code complexity
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] All 2,120 posts have cuisine field populated
- [ ] All 2,120 posts have dish tags
- [ ] `scripts/analyze_posts.py` shows 100% coverage

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-31 | Completed 1,300/2,120 posts | Script stalled mid-run, resumed from checkpoint successfully |

## Resources

- Checkpoint file: `scripts/.enrich_progress.json`
- Resume command: `python3 scripts/enrich_posts.py --phase2-only --resume`
