---
status: pending
priority: p3
issue_id: "021"
tags:
  - code-review
  - agent-native
  - venue-tags
dependencies: []
---

# Distinct exit codes for scraper failure modes

## Problem Statement

`scripts/venue-tags/scrape_google.py:269-296` and `scripts/venue-tags/lookup_place_ids.py:132` both return exit code `1` for *all* failures. An agent retrying on transient failure cannot distinguish:

- "rotate IP / wait" (rate-limited)
- "re-run bootstrap" (auth gated)
- "venue is genuinely thin" (0 chips, but page rendered)
- "Google UI changed" (selector miss)
- "network error" (transient)

Today the only signal is human-readable `log("    ERROR: ...")` lines. Those strings are not a contract — they could rewrite at any time.

This blocks the user's "MCP wrapper / cross-project agent" use case directly.

## Findings

- **Files:** `scrape_google.py:269-296`, `lookup_place_ids.py:132`
- **Failure classes seen in practice this session:**
  - "limited view" (auth gated) — recoverable via re-bootstrap
  - HTTP/network ABORT — recoverable via retry
  - 0 chips found — venue-specific, non-recoverable
  - PerimeterX "blocked" page (Yelp) — IP-level, recoverable on different network
  - Multi-match resolution failed — query-quality issue, change query

## Proposed Solutions

### Option A — Distinct exit codes + structured stderr summary

```python
EXIT_OK = 0
EXIT_GENERIC = 1
EXIT_AUTH_GATE = 2
EXIT_RATE_LIMITED = 3
EXIT_NOT_FOUND = 4
EXIT_SELECTOR_MISS = 5
```

At end of run, emit a final JSON line on stderr:

```json
{"ok": ["franklin-bbq"], "auth_gated": ["elite-sgv"], "not_found": ["animal-la"]}
```

Calling agent gets structured failure attribution without parsing log prose.

- **Pros:** machine-actionable; doesn't break the human-readable logs (still printed)
- **Cons:** must update both scripts consistently; orchestrators (sync_post_placeids.py, etc.) now need to grok the codes
- **Effort:** Small-Medium
- **Risk:** Low

### Option B — Just emit the JSON summary, keep exit code 1

```json
{"failures": [{"key": "elite-sgv", "reason": "auth_gate"}]}
```

- **Pros:** less invasive
- **Cons:** agent has to read both stderr and exit code; less "shell-script-friendly"
- **Effort:** Small
- **Risk:** None

## Recommended Action

(Filled during triage — Option A.)

## Technical Details

- **Affected files:** `scrape_google.py`, `lookup_place_ids.py`
- **Tests:** unit-testable by mocking page state and asserting exit code

## Acceptance Criteria

- [ ] At least 4 distinct exit codes for the most common failure modes
- [ ] Final JSON summary on stderr lists each venue's outcome
- [ ] Existing log output unchanged (still human-readable)

## Work Log

(Empty)

## Resources

- `scripts/venue-tags/scrape_google.py:269-296`
- `scripts/venue-tags/lookup_place_ids.py:132`
- Reasonable exit code ranges from sysexits.h
