"""Tests for set_ig_locations.py.

Covers:
- extract_venue: pure function, "Venue, City" title pattern classification
- set_location: surgical frontmatter insertion (dry-run and apply)

Run from repo root:
    python3 -m pytest scripts/test_set_ig_locations.py -v
"""
import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from set_ig_locations import extract_venue, set_location


# ---------------------------------------------------------------------------
# extract_venue
# ---------------------------------------------------------------------------

class TestExtractVenueHigh:
    def test_standard_venue_city_pattern(self):
        venue, conf = extract_venue("Chubby Cattle, Rosemead")
        assert venue == "Chubby Cattle"
        assert conf == "high"

    def test_multi_word_venue(self):
        venue, conf = extract_venue("Carnitas El Momo, Los Angeles")
        assert venue == "Carnitas El Momo"
        assert conf == "high"

    def test_single_word_venue(self):
        venue, conf = extract_venue("Had, Los Angeles")
        assert venue == "Had"
        assert conf == "high"

    def test_cjk_venue_name(self):
        venue, conf = extract_venue("小埕戏, Xiamen")
        assert venue == "小埕戏"
        assert conf == "high"

    def test_venue_with_hyphen(self):
        venue, conf = extract_venue("A-sha, San Gabriel")
        assert venue == "A-sha"
        assert conf == "high"

    def test_long_city_name(self):
        venue, conf = extract_venue("Pearl River Deli, Los Angeles")
        assert venue == "Pearl River Deli"
        assert conf == "high"


class TestExtractVenueSkip:
    def test_blog_name_is_skipped(self):
        venue, conf = extract_venue("The Thirsty Pig, Los Angeles")
        assert venue == "The Thirsty Pig"
        assert conf == "skip"

    def test_placeholder_venue_unknown(self):
        _, conf = extract_venue("Unknown Venue, Manhattan Beach")
        assert conf == "skip"

    def test_placeholder_venue_tbd(self):
        _, conf = extract_venue("TBD, Los Angeles")
        assert conf == "skip"

    def test_stadium_in_title_is_skipped(self):
        _, conf = extract_venue("Dodger Stadium, Los Angeles")
        assert conf == "skip"

    def test_mural_in_title_is_skipped(self):
        _, conf = extract_venue("Wyland Mural, Manhattan Beach")
        assert conf == "skip"

    def test_airport_in_title_is_skipped(self):
        _, conf = extract_venue("LAX Airport, Los Angeles")
        assert conf == "skip"

    def test_festival_in_title_is_skipped(self):
        _, conf = extract_venue("Lantern Festival, Chinatown")
        assert conf == "skip"


class TestExtractVenueNone:
    def test_no_comma_returns_none(self):
        _, conf = extract_venue("Had barbecue with my relatives at one of the most popular spots")
        assert conf == "none"

    def test_empty_title_returns_none(self):
        venue, conf = extract_venue("")
        assert conf == "none"
        assert venue == ""

    def test_city_only_no_venue_returns_none(self):
        _, conf = extract_venue("Los Angeles")
        assert conf == "none"

    def test_long_sentence_title_returns_none(self):
        title = "Smoked moist Brisket, spicy beef garlic sausage, brisket beans and slaw"
        # Even if there's a comma, the venue part would be too long or descriptive
        venue, conf = extract_venue(title)
        # Should not be high — venue part is a food description
        assert conf in ("none", "review")


class TestExtractVenueReview:
    def test_ambiguous_long_sentence_as_venue_part(self):
        # Starts like a venue but the "venue" part is a sentence fragment
        venue, conf = extract_venue("Enjoying a day at the park, Anaheim")
        assert conf == "review"

    def test_lowercase_word_in_venue_drops_to_review(self):
        # Mixed-case venue part that fails all-title-case check
        venue, conf = extract_venue("This is the Thai style chicken rice, San Gabriel")
        assert conf in ("review", "none")


# ---------------------------------------------------------------------------
# set_location
# ---------------------------------------------------------------------------

FM_WITH_TAGS = """\
---
title: Test Post
source: instagram
tags:
- ramen
- japanese
---

Caption text here.
"""

FM_WITHOUT_TAGS = """\
---
title: Test Post
source: instagram
---

Caption text here.
"""

FM_WITH_LOCATION = """\
---
title: Test Post
source: instagram
location: Existing Venue
tags:
- ramen
---

Caption text here.
"""


def make_post(tmp_path: Path, content: str, name: str = "test.md") -> Path:
    p = tmp_path / name
    p.write_text(content, encoding="utf-8")
    return p


class TestSetLocationDryRun:
    def test_returns_true_when_location_would_be_set(self, tmp_path):
        p = make_post(tmp_path, FM_WITH_TAGS)
        result = set_location(p, "Ramen Shop", apply=False)
        assert result is True

    def test_dry_run_does_not_write_file(self, tmp_path):
        p = make_post(tmp_path, FM_WITH_TAGS)
        set_location(p, "Ramen Shop", apply=False)
        assert "location:" not in p.read_text()

    def test_returns_false_when_location_already_set(self, tmp_path):
        p = make_post(tmp_path, FM_WITH_LOCATION)
        result = set_location(p, "New Venue", apply=False)
        assert result is False

    def test_returns_false_for_missing_frontmatter(self, tmp_path):
        p = make_post(tmp_path, "No frontmatter.\n")
        result = set_location(p, "Venue", apply=False)
        assert result is False


class TestSetLocationApply:
    def test_inserts_location_before_tags(self, tmp_path):
        p = make_post(tmp_path, FM_WITH_TAGS)
        set_location(p, "Chubby Cattle", apply=True)
        content = p.read_text()
        loc_pos = content.index("location: Chubby Cattle")
        tags_pos = content.index("tags:")
        assert loc_pos < tags_pos

    def test_location_value_written_correctly(self, tmp_path):
        p = make_post(tmp_path, FM_WITH_TAGS)
        set_location(p, "Pearl River Deli", apply=True)
        assert "location: Pearl River Deli" in p.read_text()

    def test_fallback_appends_when_no_tags_field(self, tmp_path):
        p = make_post(tmp_path, FM_WITHOUT_TAGS)
        result = set_location(p, "Woo's Crepe", apply=True)
        assert result is True
        assert "location: Woo's Crepe" in p.read_text()

    def test_body_content_unchanged_after_insertion(self, tmp_path):
        p = make_post(tmp_path, FM_WITH_TAGS)
        set_location(p, "Some Venue", apply=True)
        body = p.read_text().split("---", 2)[2]
        assert "Caption text here." in body

    def test_does_not_overwrite_existing_location(self, tmp_path):
        p = make_post(tmp_path, FM_WITH_LOCATION)
        set_location(p, "New Venue", apply=True)
        content = p.read_text()
        assert "Existing Venue" in content
        assert "New Venue" not in content

    def test_returns_true_on_successful_write(self, tmp_path):
        p = make_post(tmp_path, FM_WITH_TAGS)
        result = set_location(p, "Moo Creamery", apply=True)
        assert result is True

    def test_valid_frontmatter_after_insertion(self, tmp_path):
        import yaml
        p = make_post(tmp_path, FM_WITH_TAGS)
        set_location(p, "Halal Guys", apply=True)
        parts = p.read_text().split("---", 2)
        fm = yaml.safe_load(parts[1])
        assert fm["location"] == "Halal Guys"
        assert fm["title"] == "Test Post"
        assert fm["tags"] == ["ramen", "japanese"]
