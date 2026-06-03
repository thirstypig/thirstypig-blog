"""Tests for scrape_google.py utility functions.

auth_gated() distinguishes three structurally different page states:

  1. Logged-out / auth-gated: no tabs, no chips → True
  2. Permanently closed:      has some tabs, no chips → False
  3. Normal open venue:       has tabs + chips → False

The old implementation keyed on the presence of a "Reviews" tab, which
incorrectly returned True for closed venues (they have Overview/About but
no Reviews). The fix: gate on the absence of ANY tabs.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

# scrape_google imports playwright at module load. auth_gated() itself is pure,
# but the import chain pulls in playwright, which isn't installed in lightweight
# environments (e.g. CI's requirements-dev.txt). Skip cleanly there rather than
# erroring the whole pytest collection.
pytest.importorskip("playwright")

from scrape_google import auth_gated  # noqa: E402

# ---------------------------------------------------------------------------
# Fixtures covering the three real-world page states
# ---------------------------------------------------------------------------

LOGGED_OUT = {
    "tab_labels": [],
    "chips": [],
}

LOGGED_OUT_MISSING_KEYS = {}  # both keys absent → same as empty

CLOSED_NO_CHIPS = {
    "tab_labels": ["Overview", "About"],
    "chips": [],
}

CLOSED_NO_CHIPS_KEY_MISSING = {
    "tab_labels": ["Overview", "About"],
    # "chips" key absent
}

OPEN_WITH_CHIPS = {
    "tab_labels": ["Overview", "Menu", "Reviews", "About"],
    "chips": [{"label": "Good for groups", "count": 47}],
}

OPEN_NO_REVIEWS_TAB_BUT_HAS_CHIPS = {
    # edge case: chip data present even without Reviews tab (shouldn't fire)
    "tab_labels": ["Overview", "About"],
    "chips": [{"label": "Cozy", "count": 12}],
}


# ---------------------------------------------------------------------------
# Parametrized truth table
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("record,expected", [
    (LOGGED_OUT,                           True,  ),
    (LOGGED_OUT_MISSING_KEYS,              True,  ),
    (CLOSED_NO_CHIPS,                      False, ),
    (CLOSED_NO_CHIPS_KEY_MISSING,          False, ),
    (OPEN_WITH_CHIPS,                      False, ),
    (OPEN_NO_REVIEWS_TAB_BUT_HAS_CHIPS,    False, ),
], ids=[
    "logged-out-empty-lists",
    "logged-out-keys-absent",
    "closed-has-tabs-no-chips",
    "closed-chips-key-missing",
    "open-full-tabs-and-chips",
    "chips-present-no-reviews-tab",
])
def test_auth_gated(record, expected):
    assert auth_gated(record) is expected
