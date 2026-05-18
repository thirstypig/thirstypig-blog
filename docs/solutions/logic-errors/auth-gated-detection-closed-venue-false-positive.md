---
title: "auth_gated() misclassifies permanently closed venues as sign-in failures"
date: "2026-05-18"
problem_type: logic-error
component: scripts/venue-tags/scrape_google.py
tags: [scraper, google-maps, venue-tags, auth-detection, permanently-closed, heuristic-discrimination]
severity: medium
time_to_fix: 30 minutes
symptoms:
  - Permanently closed restaurants exit with code 2 (auth-gated) instead of writing 0-chip output files
  - Closed venues like itoya-shanghai, la-finca-shanghai, freedmens-bar-austin produce no artifacts
  - No error message distinguishes "auth failure" from "closed venue" — silent wrong-exit
  - Re-running bootstrap_profile.py has no effect (not actually an auth problem)
---

# auth_gated() misclassifies permanently closed venues as sign-in failures

## Problem

`auth_gated()` in `scripts/venue-tags/scrape_google.py` used the presence of a "Reviews" tab as its discriminating signal for the Google Maps "limited view" (logged-out) page state. Permanently closed venues also lack a Reviews tab — and also have no chips — so they triggered the same exit-2 code path as genuinely auth-gated pages.

The scraper would silently drop closed venues from the output batch with an unhelpful error: "page has no Reviews tab or chips — looks like Google's 'limited view'." The actual page was fully accessible and correctly structured for a closed venue; the heuristic was wrong.

## Root Cause

Three structurally distinct page states exist on Google Maps:

| State | Tab bar | Chips | auth_gated (OLD) | auth_gated (NEW) |
|-------|---------|-------|-------------------|-------------------|
| Truly auth-gated (logged-out) | Empty — no tabs at all | None | `True` ✓ | `True` ✓ |
| Permanently closed | Overview, About (no Reviews) | None | `True` ✗ | `False` ✓ |
| Open venue | Overview, Menu, Reviews, About | Present | `False` ✓ | `False` ✓ |

The old heuristic keyed on "no Reviews tab AND no chips" — a condition that correlated with auth-gating but was not sufficient: closed venues match it too. The correct discriminating signal is "no tabs at all," which is necessary and sufficient for the logged-out state.

This is the standard heuristic-discrimination failure mode: the signal chosen (`has_reviews_tab`) is **correlated with** the error case but not **exclusive to** it. See [[jaccard-signature-collision-false-positive-guard]] for the primary pattern doc.

## Fix

```python
# BEFORE — fires for permanently closed venues too
def auth_gated(record: dict) -> bool:
    has_reviews_tab = any(
        "Reviews" in (label or "") for label in record.get("tab_labels", [])
    )
    return not has_reviews_tab and not record.get("chips")

# AFTER — only fires when the tab bar is completely empty (true logged-out state)
def auth_gated(record: dict) -> bool:
    """Detect the 'limited view' failure mode.

    Logged-in places have 4 tabs (Overview/Menu/Reviews/About) and at
    least some chips. Logged-out places have NO tabs at all and no chips.
    Permanently closed venues have Overview/About tabs but no Reviews tab
    or chips — those are NOT auth-gated, just closed."""
    tab_labels = record.get("tab_labels", [])
    return not tab_labels and not record.get("chips")
```

**What changed:** The condition flipped from "Reviews tab is absent" to "tab bar is entirely empty." A closed venue has `tab_labels = ["Overview", "About"]`, so `not tab_labels` is `False`, and `auth_gated()` correctly returns `False`.

## What This Fix Does NOT Solve

- **Venues with a CID whose Chrome session has genuinely expired:** these still correctly trigger `auth_gated()` and require re-running `bootstrap_profile.py`. (5 such venues were observed in the same batch.)
- **Venues with no CID at all:** they have no Google Maps listing and cannot be resolved by any scraper fix — leave them untagged or find the CID manually.
- **Missing count assertion:** the caller should assert on output counts after any batch scrape run. A run that produces zero artifacts for N expected venues should fail loudly. See [[google-maps-cid-fid-self-healing-scrape]] for the count-assertion pattern.

## Tests Added

`scripts/venue-tags/test_scrape_google.py` — 6 parametrized cases:

```python
@pytest.mark.parametrize("record,expected", [
    ({"tab_labels": [], "chips": []},                               True),   # truly auth-gated
    ({},                                                            True),   # keys absent
    ({"tab_labels": ["Overview", "About"], "chips": []},            False),  # closed venue
    ({"tab_labels": ["Overview", "About"]},                         False),  # closed, chips key absent
    ({"tab_labels": ["Overview","Menu","Reviews","About"],
      "chips": [{"label": "Good for groups"}]},                     False),  # open venue
    ({"tab_labels": ["Overview", "About"],
      "chips": [{"label": "Cozy"}]},                                False),  # chips present, no Reviews tab
], ids=[
    "logged-out-empty-lists", "logged-out-keys-absent",
    "closed-has-tabs-no-chips", "closed-chips-key-missing",
    "open-full-tabs-and-chips", "chips-present-no-reviews-tab",
])
def test_auth_gated(record, expected):
    assert auth_gated(record) is expected
```

The critical regression case is `closed-has-tabs-no-chips`: the old implementation returned `True` (auth-gated) for this fixture; the new implementation returns `False`. If the fix is reverted, this case breaks immediately.

## Prevention

### Before writing any scraper detection heuristic

1. **Enumerate all page states** that produce the observed symptom — not just the error state you're targeting.
2. **Identify the minimum sufficient condition:** "what is true when the bug occurs AND false in all legitimate cases?" Correlated ≠ discriminating.
3. **Prefer presence-based signals over absence-based ones.** "No tabs at all" is more stable than "Reviews tab missing" because absence of optional features has many legitimate causes.
4. **Write negative fixtures for every lookalike state.** If there are three ways to look like the bug without being the bug, there are three required negative test cases.
5. **Add a count assertion downstream.** The caller of `auth_gated()` should assert that fewer than some threshold of venues are flagged per batch — a 30% auth-gate rate in a fresh session is a signal the heuristic is misfiring.

### Warning signs a heuristic may be under-discriminating

- Signal is absence-based and the absent thing has multiple causes
- Heuristic was written by observing one example of the bug (single-example induction)
- No test fixtures for non-error states that resemble the error state
- Trigger rate in production is suspiciously high
- Function name says `is_X` but body checks `not Y` (semantic mismatch between identity and proxy detection)

## Related

- [`docs/solutions/api-migration/google-maps-cid-fid-self-healing-scrape.md`](../api-migration/google-maps-cid-fid-self-healing-scrape.md) — Prior silent-fail incident on the same script (98-venue batch, null place_id); count-assertion pattern in Prevention section.
- [`docs/solutions/test-failures/jaccard-signature-collision-false-positive-guard.md`](../test-failures/jaccard-signature-collision-false-positive-guard.md) — Primary pattern doc for heuristic discrimination: paired-corpus test harness and the "correlation ≠ discrimination" rule.
- [`docs/solutions/api-migration/google-places-migration-and-data-repair.md`](../api-migration/google-places-migration-and-data-repair.md) — Origins of the persistent Chrome profile / auth-required architecture.
- Memory `feedback_heuristic_discrimination.md` — Rule: validate heuristic against paired bug+legit fixtures before shipping.
- Memory `feedback_silent_fail_class.md` — Rule: pipeline steps that succeed-as-no-op need explicit count assertions.
