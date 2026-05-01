"""Tests for curate_candidates.is_non_food.

Locked-down regressions from docs/operator/curator-bugs.md:
- The naive \\bpark\\b pattern false-matches "Park's BBQ" because Python's
  \\b treats apostrophe as a word boundary.
- Auto repair, service shops, etc. need explicit filtering — they were
  surfacing as venue candidates in batches 7–8.
"""

from __future__ import annotations

from curate_candidates import is_non_food


# Real venue names that MUST pass through the filter (food, will be tagged)
REAL_FOOD_VENUES = [
    "Park's BBQ",  # Korean BBQ in LA — was being filtered by \bpark\b
    "Park's Finest BBQ",
    "Joe's Pizza",
    "Pine & Crane",
    "Jitlada",
    "Din Tai Fung",
    "Franklin Barbecue",
    "Sushi Park",  # ends with "park" — but our pattern is word-boundary, not suffix
    "Auto Bakery",  # contains "auto" only as a brand — but \bauto\b will catch this
                    # — flagged as known limitation; revisit if real food venue lost
]

# Names that MUST be filtered as non-food
NON_FOOD_VENUES = [
    "Mickey's Auto Repair",
    "Joe's Auto Service",
    "Westside Auto",
    "Quick Service Cleaners",
    "AC Repair Pros",
    "Griffith Park",
    "Disneyland Hotel",
    "The Broad",
    "Universal Studios Hilton",
]


def test_park_apostrophe_does_not_false_match():
    """\\bpark(?!')\\b must not filter possessive forms."""
    assert is_non_food("Park's BBQ") is False
    assert is_non_food("park's grill") is False
    assert is_non_food("PARK'S DELI") is False  # case-insensitive


def test_park_word_still_filtered_when_standalone():
    """The original intent — filter actual parks — still works."""
    assert is_non_food("Griffith Park") is True
    assert is_non_food("park view") is True
    assert is_non_food("Hyde Park Cafeteria") is True


def test_auto_repair_filtered():
    assert is_non_food("Mickey's Auto Repair") is True
    assert is_non_food("Joe's Auto Service") is True
    assert is_non_food("Westside Auto") is True


def test_service_filtered():
    assert is_non_food("Quick Service Cleaners") is True
    assert is_non_food("AC Repair Pros") is True


def test_food_venues_pass_through():
    """Spot-check real food venues to make sure no new pattern over-filters."""
    food_venues_must_pass = [
        "Park's BBQ",
        "Joe's Pizza",
        "Pine & Crane",
        "Jitlada",
        "Din Tai Fung",
        "Franklin Barbecue",
    ]
    for v in food_venues_must_pass:
        assert is_non_food(v) is False, f"false-positive: {v}"
