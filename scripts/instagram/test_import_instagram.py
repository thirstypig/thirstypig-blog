"""Tests for the Instagram importer's duplicate detection.

Regression guard for the dedup bug that would have re-imported already-published
posts on a re-sync: once a post is enriched, its title is rewritten ("Venue, City")
and its pubDate becomes a full datetime ("2026-03-04 00:00:00+00:00"). The old
dedup compared that datetime string against "2026-03-04" (never equal) and fell
back to raw-title similarity (broken by the retitle), so it flagged real
duplicates as new. The fix: for source=="instagram", match on date alone.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from import_instagram import is_duplicate  # noqa: E402


def _existing(title, date, source):
    # Mirrors the shape load_existing_posts() produces (date already normalized to YYYY-MM-DD).
    return {"title": title.lower(), "date": date, "source": source, "file": "x.md"}


def test_same_date_instagram_post_is_duplicate_even_when_title_drifted():
    # Existing post was enriched to a "Venue, City" title; export still has the raw caption.
    existing = [_existing("kyoto wagyu tonkatsu ten no meshi la, los angeles", "2026-03-04", "instagram")]
    assert is_duplicate("Katsu at", datetime(2026, 3, 4), existing) is True


def test_new_date_is_not_duplicate():
    # A new visit on a date with no existing post — must import.
    existing = [_existing("kyoto wagyu tonkatsu ten no meshi la, los angeles", "2026-03-04", "instagram")]
    assert is_duplicate("Stinky tofu at Tofu King in Arcadia", datetime(2026, 4, 27), existing) is False


def test_recurring_venue_new_date_is_not_duplicate():
    # Same venue posted before, but on a different date = a new visit, not a duplicate.
    existing = [_existing("dai ho restaurant, temple city", "2019-05-01", "instagram")]
    assert is_duplicate("Dai Ho restaurant, Temple City", datetime(2026, 5, 17), existing) is False


def test_non_instagram_same_date_falls_back_to_title_similarity():
    # A recovered blog post on the same date with an unrelated title is not a dup.
    existing = [_existing("my top 10 barbecue joints in la", "2026-03-04", "blog")]
    assert is_duplicate("Katsu at", datetime(2026, 3, 4), existing) is False
