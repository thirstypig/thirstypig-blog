"""Tests for seed_hitlist_vault.py — converts places-hitlist.yaml into
the vault markdown format.

The critical invariant this module must preserve is **round-trip stability**:
seeded markdown, when re-parsed by sync_hitlist_from_md.py, must reproduce
the same ids, names, cities, priorities, and links. Otherwise switching a
user from admin-UI editing to vault editing would silently break every
existing entry's id.

Run from repo root:
    python3 -m pytest scripts/test_seed_hitlist_vault.py -v
"""
from pathlib import Path

import pytest
import yaml

from seed_hitlist_vault import entry_to_md
from sync_hitlist_from_md import parse_markdown


REPO_ROOT = Path(__file__).parent.parent
HITLIST_YAML = REPO_ROOT / "src" / "data" / "places-hitlist.yaml"


class TestEntryToMd:
    def test_minimal_entry_emits_header_and_id(self):
        md = entry_to_md({
            "id": "test-entry",
            "name": "Test",
            "city": "Nowhere",
        })
        assert md.startswith("## Test, Nowhere")
        assert "- id: test-entry" in md

    def test_header_drops_city_when_absent(self):
        # Defensive — shouldn't happen in practice (city is required) but
        # entry_to_md shouldn't crash on partial data
        md = entry_to_md({
            "id": "x",
            "name": "Just A Name",
        })
        assert md.startswith("## Just A Name\n")
        assert ", " not in md.split("\n")[0]  # no ", City" suffix

    def test_all_fields_present(self):
        md = entry_to_md({
            "id": "kato",
            "name": "Kato",
            "city": "Los Angeles",
            "neighborhood": "DTLA",
            "priority": 1,
            "date_added": "2026-04-16",
            "notes": "Taiwanese tasting menu",
            "tags": ["taiwanese", "tasting-menu", "michelin"],
            "links": {
                "yelp": "https://yelp.com/biz/kato",
                "google": "https://maps.app.goo.gl/abc",
                "instagram": "https://instagram.com/kato",
                "website": "https://katorestaurant.com",
            },
        })
        assert "## Kato, Los Angeles" in md
        assert "Taiwanese tasting menu" in md
        assert "- id: kato" in md
        assert "- neighborhood: DTLA" in md
        assert "- priority: 1" in md
        assert "- date_added: 2026-04-16" in md
        assert "- tags: taiwanese, tasting-menu, michelin" in md
        assert "- yelp: https://yelp.com/biz/kato" in md
        assert "- google: https://maps.app.goo.gl/abc" in md
        assert "- instagram: https://instagram.com/kato" in md
        assert "- website: https://katorestaurant.com" in md

    def test_optional_fields_omitted_when_absent(self):
        md = entry_to_md({
            "id": "minimal",
            "name": "Minimal",
            "city": "X",
            "priority": 2,
        })
        assert "- neighborhood" not in md
        assert "- tags" not in md
        assert "- yelp" not in md
        assert "- notes" not in md

    def test_id_override_always_emitted(self):
        """Regression guard — the id MUST always be explicit in the markdown.
        Without this, round-trip stability breaks as soon as slugify() rules
        change, because sync would regenerate ids from names."""
        md = entry_to_md({
            "id": "el-moro",
            "name": "Churrería El Moro",
            "city": "Los Angeles",
        })
        assert "- id: el-moro" in md

    def test_empty_links_dict_omits_link_lines(self):
        md = entry_to_md({
            "id": "x", "name": "X", "city": "Y", "priority": 2,
            "links": {},
        })
        for key in ("yelp", "google", "instagram", "resy", "opentable", "website"):
            assert f"- {key}:" not in md

    def test_links_with_null_values_skipped(self):
        """Schema allows `yelp: null` — entry_to_md must not emit those."""
        md = entry_to_md({
            "id": "x", "name": "X", "city": "Y", "priority": 2,
            "links": {"yelp": None, "google": "https://example.com"},
        })
        assert "- yelp:" not in md
        assert "- google: https://example.com" in md


class TestRoundTrip:
    """Integration: seed the current places-hitlist.yaml, re-parse, assert
    semantic equivalence. Guards against any change to entry_to_md that would
    silently corrupt production data on next sync."""

    @pytest.fixture(scope="class")
    def seeded_and_parsed(self):
        # Load the real production YAML
        with open(HITLIST_YAML, encoding="utf-8") as f:
            original = yaml.safe_load(f)

        # Seed to markdown
        md = "\n\n".join(entry_to_md(e) for e in original)

        # Parse back through the vault parser
        parsed = parse_markdown(md)

        return original, parsed

    def test_entry_count_preserved(self, seeded_and_parsed):
        original, parsed = seeded_and_parsed
        assert len(parsed) == len(original)

    def test_every_id_preserved(self, seeded_and_parsed):
        """The point of this whole test module — ids must survive round-trip."""
        original, parsed = seeded_and_parsed
        original_ids = [e["id"] for e in original]
        parsed_ids = [e["id"] for e in parsed]
        assert parsed_ids == original_ids

    def test_names_and_cities_preserved(self, seeded_and_parsed):
        original, parsed = seeded_and_parsed
        for o, p in zip(original, parsed):
            assert p["name"] == o["name"], f"name drift on id={o['id']}"
            assert p["city"] == o["city"], f"city drift on id={o['id']}"

    def test_priorities_preserved(self, seeded_and_parsed):
        original, parsed = seeded_and_parsed
        for o, p in zip(original, parsed):
            assert p["priority"] == o["priority"], f"priority drift on id={o['id']}"

    def test_links_preserved(self, seeded_and_parsed):
        original, parsed = seeded_and_parsed
        for o, p in zip(original, parsed):
            o_links = {k: v for k, v in (o.get("links") or {}).items() if v}
            p_links = p.get("links") or {}
            assert p_links == o_links, f"links drift on id={o['id']}"

    def test_tags_preserved(self, seeded_and_parsed):
        original, parsed = seeded_and_parsed
        for o, p in zip(original, parsed):
            o_tags = o.get("tags") or []
            p_tags = p.get("tags") or []
            assert p_tags == o_tags, f"tags drift on id={o['id']}"

    def test_non_ascii_names_round_trip(self, seeded_and_parsed):
        """Specific guard for Churrería El Moro and Persé, which have
        accented characters that have tripped parsers before."""
        _, parsed = seeded_and_parsed
        parsed_by_id = {e["id"]: e for e in parsed}

        # These ids + names exist in the current production YAML
        if "el-moro" in parsed_by_id:
            assert "Churrería" in parsed_by_id["el-moro"]["name"]
        if "perse" in parsed_by_id:
            assert "Persé" == parsed_by_id["perse"]["name"]
