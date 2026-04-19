"""Tests for sync_hitlist_from_md.py — the Obsidian vault → YAML parser.

Run from repo root:
    python3 -m pytest scripts/test_sync_hitlist.py -v

Covers the edge cases that matter for round-trip stability with the admin UI
and Astro's content loader.
"""
from datetime import date

import pytest

from sync_hitlist_from_md import parse_markdown, parse_entry, parse_header, slugify


class TestParseHeader:
    def test_basic_name_city(self):
        name, city = parse_header("## Miopane, Pasadena")
        assert name == "Miopane"
        assert city == "Pasadena"

    def test_splits_on_last_comma_for_names_with_commas(self):
        # "Ma's, Kitchen" would be the name if someone has a comma in it
        name, city = parse_header("## Ma's, Kitchen, Pasadena")
        assert name == "Ma's, Kitchen"
        assert city == "Pasadena"

    def test_header_without_comma_returns_blank_city(self):
        # Validator will reject this at commit time — behavior is intentional
        name, city = parse_header("## Just a name")
        assert name == "Just a name"
        assert city == ""

    def test_non_header_line_returns_empty_tuple(self):
        assert parse_header("not a header") == ("", "")
        assert parse_header("# Wrong header level") == ("", "")
        assert parse_header("### Too deep") == ("", "")


class TestParseEntry:
    def test_minimum_viable_entry(self):
        """Just a header + city should produce a valid entry with defaults."""
        entry = parse_entry("Kato", "Los Angeles", [])
        assert entry["name"] == "Kato"
        assert entry["city"] == "Los Angeles"
        assert entry["id"] == "kato"
        assert entry["priority"] == 2  # default
        assert entry["date_added"] == date.today().isoformat()
        assert "links" not in entry  # empty links omitted
        assert "tags" not in entry   # empty tags omitted

    def test_notes_from_paragraph_before_metadata(self):
        entry = parse_entry("X", "Y", [
            "First line of notes.",
            "Second line continues.",
            "",
            "- priority: 1",
        ])
        assert entry["notes"] == "First line of notes. Second line continues."
        assert entry["priority"] == 1

    def test_all_metadata_keys_parsed(self):
        entry = parse_entry("X", "Y", [
            "- priority: 1",
            "- neighborhood: Downtown",
            "- date_added: 2026-04-19",
            "- tags: tag-one, tag-two",
            "- id: custom-id",
            "- yelp: https://yelp.com/biz/x",
            "- google: https://maps.google.com/x",
            "- website: https://example.com",
        ])
        assert entry["priority"] == 1
        assert entry["neighborhood"] == "Downtown"
        assert entry["date_added"] == "2026-04-19"
        assert entry["tags"] == ["tag-one", "tag-two"]
        assert entry["id"] == "custom-id"
        assert entry["links"]["yelp"] == "https://yelp.com/biz/x"
        assert entry["links"]["google"] == "https://maps.google.com/x"
        assert entry["links"]["website"] == "https://example.com"

    def test_tag_normalization_lowercase_and_hyphens(self):
        entry = parse_entry("X", "Y", [
            "- tags: Multiple Words, UPPERCASE, already-hyphenated",
        ])
        assert entry["tags"] == ["multiple-words", "uppercase", "already-hyphenated"]

    def test_unknown_keys_silently_dropped(self):
        """Future-proofing: vault schema can add keys without breaking old parsers."""
        entry = parse_entry("X", "Y", [
            "- priority: 1",
            "- bogus_key: should be ignored",
            "- another_unknown: also ignored",
        ])
        assert entry["priority"] == 1
        assert "bogus_key" not in entry
        assert "another_unknown" not in entry

    def test_priority_out_of_range_falls_back_to_default(self):
        entry = parse_entry("X", "Y", ["- priority: 99"])
        assert entry["priority"] == 2  # default preserved, bad value discarded

        entry = parse_entry("X", "Y", ["- priority: 0"])
        assert entry["priority"] == 2

        entry = parse_entry("X", "Y", ["- priority: not-a-number"])
        assert entry["priority"] == 2

    def test_priority_accepts_1_2_3(self):
        for p in (1, 2, 3):
            entry = parse_entry("X", "Y", [f"- priority: {p}"])
            assert entry["priority"] == p

    def test_id_slugified_from_name_when_not_overridden(self):
        entry = parse_entry("Churrería El Moro", "Los Angeles", [])
        # Slugify strips diacritics poorly in Python — documented limitation,
        # vault user can override with - id:
        assert entry["id"].startswith("churrer")
        assert "moro" in entry["id"]

    def test_id_override_wins_over_slug(self):
        entry = parse_entry("Churrería El Moro", "LA", ["- id: el-moro"])
        assert entry["id"] == "el-moro"

    def test_notes_key_accumulates_with_paragraph(self):
        """When a `- notes:` bullet appears alongside a paragraph, both combine."""
        entry = parse_entry("X", "Y", [
            "Opening paragraph.",
            "- notes: Extra structured note.",
        ])
        assert "Opening paragraph." in entry["notes"]
        assert "Extra structured note." in entry["notes"]


class TestParseMarkdown:
    def test_empty_input_returns_empty_list(self):
        assert parse_markdown("") == []
        assert parse_markdown("# Heading only, no entries") == []

    def test_multiple_entries(self):
        entries = parse_markdown("""\
## First, Place
Notes one.
- priority: 1

## Second, Elsewhere
Notes two.
- priority: 3
""")
        assert len(entries) == 2
        assert entries[0]["name"] == "First"
        assert entries[0]["priority"] == 1
        assert entries[1]["name"] == "Second"
        assert entries[1]["priority"] == 3

    def test_content_before_first_header_is_ignored(self):
        """A preamble (docs, instructions) above the first ## should not corrupt parsing."""
        entries = parse_markdown("""\
# Hit List

Some preamble text that shouldn't become notes.

## Real entry, City
Real notes.
""")
        assert len(entries) == 1
        assert entries[0]["notes"] == "Real notes."

    def test_non_ascii_characters_survive_round_trip(self):
        entries = parse_markdown("## Churrería El Moro, Los Angeles\nSpanish churros.")
        assert entries[0]["name"] == "Churrería El Moro"
        assert entries[0]["notes"] == "Spanish churros."


class TestSlugify:
    def test_lowercases(self):
        assert slugify("HELLO") == "hello"

    def test_spaces_become_hyphens(self):
        assert slugify("Hello World") == "hello-world"

    def test_collapses_multiple_non_alphanumeric(self):
        assert slugify("foo!!!bar") == "foo-bar"

    def test_strips_leading_trailing_hyphens(self):
        assert slugify("  padded  ") == "padded"

    def test_empty_after_normalization_returns_empty_string(self):
        # Pure CJK strips to nothing — callers should detect this and ask for an override
        assert slugify("鹿港") == ""
