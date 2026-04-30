"""Tests for lookup_place_ids_api.py — the Places API (New) → venues.yaml path.

This pipeline silently fails open when its parsers regress: the API call
succeeds, but extract_fid_hex returns None and write_yaml_field's regex
misses, so we end up with a venues.yaml that looks fine and a scraper that
won't navigate to the right place. Both modes were lived through earlier
this session — these tests pin them down.

Run from repo root:
    python3 -m pytest scripts/venue-tags/test_lookup_place_ids_api.py -v
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from lookup_place_ids_api import (  # noqa: E402
    CID_RE,
    FID_HEX_RE,
    extract_fid_hex,
    write_yaml_field,
)


class TestExtractFidHex:
    def test_returns_none_for_none(self):
        assert extract_fid_hex(None) is None

    def test_returns_none_for_empty_string(self):
        assert extract_fid_hex("") is None

    def test_returns_none_for_cid_only_uri(self):
        """The common case: API gives us a `?cid=N` URL with no FID hex.
        scrape_google.py needs to fall through to the cid path; if this ever
        starts returning something, it'll crash schema validation downstream."""
        assert extract_fid_hex("https://maps.google.com/?cid=3748056888387165481") is None

    def test_extracts_fid_from_data_param(self):
        """Maps' canonical /maps/place URL embeds FID as `!1s<hex>:<hex>`.
        This is the 5%-or-so case where the API returns it directly."""
        uri = (
            "https://www.google.com/maps/place/Foo+Bar/"
            "@31.21,121.46,17z/data=!3m1!4b1!4m6!3m5"
            "!1s0x80c2c79f65c05a3f:0x36ae812febfdc501"
            "!8m2!3d31.21!4d121.46"
        )
        assert extract_fid_hex(uri) == "0x80c2c79f65c05a3f:0x36ae812febfdc501"

    def test_extracts_fid_with_minimal_uri(self):
        assert (
            extract_fid_hex("anything!1s0x1:0xabcdef0123456789xxx")
            == "0x1:0xabcdef0123456789"
        )


class TestFidHexRegex:
    def test_matches_lowercase_hex(self):
        assert FID_HEX_RE.search("!1s0x80c2c79f65c05a3f:0x36ae812febfdc501") is not None

    def test_does_not_match_without_1s_prefix(self):
        """Bare `0x...:0x...` shows up in unrelated places (cid encodings
        with a 0x0 upper half, sample links). The `!1s` prefix anchors us
        to the FID-bearing context."""
        assert FID_HEX_RE.search("0x80c2c79f65c05a3f:0x36ae812febfdc501") is None

    def test_does_not_match_uppercase(self):
        """Google's API returns FIDs in lowercase. If we ever see uppercase,
        it's not a real FID — likely a doc-string or test fixture leaking."""
        assert FID_HEX_RE.search("!1s0X80C2C79F:0XABCDEF") is None


class TestCidRegex:
    def test_matches_cid_after_question_mark(self):
        m = CID_RE.search("https://maps.google.com/?cid=12345")
        assert m and m.group(1) == "12345"

    def test_matches_cid_after_ampersand(self):
        m = CID_RE.search("https://maps.google.com/?foo=bar&cid=67890")
        assert m and m.group(1) == "67890"

    def test_does_not_match_cid_substring_without_param_boundary(self):
        """Regression guard: an over-eager `cid=` regex would match
        substrings inside other URL params. The `[?&]` boundary is what
        makes this safe to run on full Google URIs."""
        assert CID_RE.search("https://example.com/incident=42") is None
        assert CID_RE.search("/decid=99") is None


class TestWriteYamlField:
    """write_yaml_field mutates venues.yaml via regex sub. The risk is silent
    misses: if the pattern doesn't match, the field doesn't get written and
    the next scrape run navigates with stale data. The function does emit a
    WARN line on miss, but tests pin the success path."""

    SAMPLE_YAML = """\
- key: alpha-place
  name: "Alpha"
  city: "City A"
  query: "Alpha 123 Main St"
- key: beta-place
  name: "Beta"
  city: "City B"
  query: "Beta 456 Oak Ave"
- key: gamma-place
  name: "Gamma"
  city: "City C"
  query: "Gamma 789 Elm Rd"
"""

    @pytest.fixture
    def yaml_path(self, tmp_path, monkeypatch):
        path = tmp_path / "venues.yaml"
        path.write_text(self.SAMPLE_YAML)
        # Both modules read the global VENUES_PATH at call time, not import time
        monkeypatch.setattr("lookup_place_ids_api.VENUES_PATH", path)
        return path

    def test_injects_place_id_after_query(self, yaml_path):
        n = write_yaml_field({"beta-place": {"place_id": "0xa:0xb"}})
        assert n == 1
        content = yaml_path.read_text()
        # The injected line should sit immediately after beta's query line
        assert '  query: "Beta 456 Oak Ave"\n  place_id: "0xa:0xb"\n' in content

    def test_does_not_touch_other_entries(self, yaml_path):
        write_yaml_field({"beta-place": {"place_id": "0xa:0xb"}})
        content = yaml_path.read_text()
        # Alpha and gamma should be byte-identical to the input — no spurious
        # field bleed-over from a too-greedy regex
        assert '- key: alpha-place\n  name: "Alpha"\n  city: "City A"\n  query: "Alpha 123 Main St"\n' in content
        assert '- key: gamma-place\n  name: "Gamma"\n  city: "City C"\n  query: "Gamma 789 Elm Rd"\n' in content

    def test_injects_multiple_fields_per_venue(self, yaml_path):
        n = write_yaml_field({"beta-place": {"place_id": "0xa:0xb", "cid": "999"}})
        assert n == 1
        content = yaml_path.read_text()
        # Both fields should land as separate consecutive lines, in order
        assert (
            '  query: "Beta 456 Oak Ave"\n'
            '  place_id: "0xa:0xb"\n'
            '  cid: "999"\n'
        ) in content

    def test_returns_zero_when_key_not_found(self, yaml_path, capsys):
        n = write_yaml_field({"nonexistent-place": {"place_id": "0xa:0xb"}})
        assert n == 0
        # File should be byte-identical to input
        assert yaml_path.read_text() == self.SAMPLE_YAML
        # The WARN line is the only signal a refactor would silently break
        assert "WARN: didn't inject nonexistent-place" in capsys.readouterr().out

    def test_writes_multiple_venues_in_one_call(self, yaml_path):
        n = write_yaml_field({
            "alpha-place": {"place_id": "0x1:0x2"},
            "gamma-place": {"place_id": "0x3:0x4"},
        })
        assert n == 2
        content = yaml_path.read_text()
        assert '  query: "Alpha 123 Main St"\n  place_id: "0x1:0x2"\n' in content
        assert '  query: "Gamma 789 Elm Rd"\n  place_id: "0x3:0x4"\n' in content
        # Beta untouched
        assert '- key: beta-place\n  name: "Beta"\n  city: "City B"\n  query: "Beta 456 Oak Ave"\n' in content
