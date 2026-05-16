---
status: pending
priority: p3
issue_id: "022"
tags:
  - code-review
  - agent-native
  - venue-tags
dependencies: []
---

# Add `--check-auth` mode + `probe_yelp.py` so agents can pre-flight

## Problem Statement

Two human-only checkpoints block fully autonomous pipeline runs:

1. **No way for an agent to verify the Chrome profile is signed in.** The pipeline assumes a pre-warmed `.chrome-profile/` exists. There's no `is the profile valid?` probe an agent can run before starting a 50-venue scrape. If auth went stale overnight, the agent finds out 5 minutes in.

2. **`YELP.md:51-55` step 1 is "open it in your regular Chrome and see if review content loads"** — visual check, no agent path. The rest of the playbook (steps 2–6: bootstrap, scrape_yelp.py spec, slug pre-fill, publish.py merge, VenueTags render) is solidly agent-actionable. The gating step is the blocker.

Both are cheap to fix and turn the pipeline into something a `/loop` or `/schedule` agent could drive.

## Findings

- **Pre-flight gate:** today, `scrape_google.py` discovers auth gate ~5s into a real venue scrape. Should be a single canary call instead.
- **Yelp probe:** today's manual workflow ("look at it in regular Chrome") cannot be automated. A headless probe checking for the documented "You have been blocked" string would.

## Proposed Solutions

### Option A — `scrape_google.py --check-auth` + `probe_yelp.py`

```bash
# Returns 0 if Chrome profile sees Reviews tab on a known canary venue (Franklin BBQ)
scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py --check-auth

# Returns 0 if Yelp serves a real biz page; exit 3 if PerimeterX block
scripts/venue-tags/venv/bin/python scripts/venue-tags/probe_yelp.py
```

- **Pros:** unblocks `/loop`-driven retries; clean exit codes; small additions
- **Cons:** ~50 lines new code total
- **Effort:** Small
- **Risk:** None

### Option B — Document the manual checks more rigorously, no automation

- **Pros:** zero work
- **Cons:** doesn't solve the autonomy goal
- **Effort:** None
- **Risk:** None

## Recommended Action

(Filled during triage — Option A.)

## Technical Details

- **Affected files:**
  - `scripts/venue-tags/scrape_google.py` (add `--check-auth` arg)
  - `scripts/venue-tags/probe_yelp.py` (new, ~30 lines)
  - `scripts/venue-tags/YELP.md` (replace step 1 prose with a one-line script invocation)

## Acceptance Criteria

- [ ] `--check-auth` returns 0 when profile is signed in, 2 when auth-gated
- [ ] `probe_yelp.py` returns 0 when biz page renders, 3 when PerimeterX blocked
- [ ] YELP.md step 1 references the probe script

## Work Log

(Empty)

## Resources

- `scripts/venue-tags/YELP.md:51-55`
- `scripts/venue-tags/scrape_google.py:189-197` (existing `auth_gated()` heuristic — reuse for canary)
- Issue #021 (distinct exit codes) — companion improvement
