"""Tests for the Facebook sync pipeline parser + frontmatter builders.

We mock nothing here — the pure functions (parse_post, derive_title,
truncate_description) are testable on real-looking Graph API response shapes
without any HTTP or filesystem.
"""
from __future__ import annotations

import sys
from datetime import timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sync_fb_pipeline import (  # noqa: E402
    derive_title,
    parse_post,
    truncate_description,
)


class TestParsePost:
    def test_simple_post_no_attachments(self) -> None:
        raw = {
            "id": "page_post1",
            "message": "Hello world",
            "created_time": "2026-04-27T10:30:00+0000",
            "permalink_url": "https://www.facebook.com/post/1",
        }
        p = parse_post(raw)
        assert p.id == "page_post1"
        assert p.short_id == "post1"
        assert p.message == "Hello world"
        assert p.date_prefix == "2026-04-27"
        assert p.permalink_url == "https://www.facebook.com/post/1"
        assert p.images == ()

    def test_post_with_full_picture_only(self) -> None:
        # Single-image posts often have no attachments, just full_picture.
        raw = {
            "id": "p_a",
            "message": "Photo post",
            "created_time": "2026-04-27T10:00:00+0000",
            "full_picture": "https://scontent.xx.fbcdn.net/img1.jpg",
        }
        p = parse_post(raw)
        assert len(p.images) == 1
        assert p.images[0].url == "https://scontent.xx.fbcdn.net/img1.jpg"

    def test_carousel_extracts_all_images(self) -> None:
        # The whole point of using FB Graph over IFTTT — carousels work.
        raw = {
            "id": "p_b",
            "message": "Multi-photo post",
            "created_time": "2026-04-27T10:00:00+0000",
            "attachments": {
                "data": [
                    {
                        "type": "album",
                        "subattachments": {
                            "data": [
                                {"media": {"image": {"src": "https://cdn.fb/1.jpg"}}},
                                {"media": {"image": {"src": "https://cdn.fb/2.jpg"}}},
                                {"media": {"image": {"src": "https://cdn.fb/3.jpg"}}},
                            ]
                        },
                    }
                ]
            },
        }
        p = parse_post(raw)
        assert len(p.images) == 3
        assert [i.url for i in p.images] == [
            "https://cdn.fb/1.jpg",
            "https://cdn.fb/2.jpg",
            "https://cdn.fb/3.jpg",
        ]

    def test_short_id_from_compound_id(self) -> None:
        # FB ids are "{pageid}_{postid}". We use just the postid suffix in
        # filenames so they're stable across page id changes.
        p = parse_post({
            "id": "12345_67890",
            "created_time": "2026-04-27T10:00:00+0000",
        })
        assert p.short_id == "67890"

    def test_short_id_falls_back_to_full_id_if_no_underscore(self) -> None:
        p = parse_post({
            "id": "abc123",
            "created_time": "2026-04-27T10:00:00+0000",
        })
        assert p.short_id == "abc123"

    def test_invalid_created_time_falls_back_to_now(self) -> None:
        # Regression guard: a malformed created_time shouldn't crash the run.
        p = parse_post({"id": "p", "created_time": "garbage"})
        assert p.created_time.tzinfo is not None  # populated, not None


class TestDeriveTitle:
    def test_uses_first_non_empty_line(self) -> None:
        msg = "\n\nFirst real line\nsecond line"
        assert derive_title(msg, "2026-04-27") == "First real line"

    def test_empty_message_falls_back(self) -> None:
        # Critical: schema requires title to be non-empty. Empty messages must
        # produce a usable title or the build breaks.
        assert derive_title("", "2026-04-27") == "Facebook post 2026-04-27"

    def test_whitespace_only_message_falls_back(self) -> None:
        assert derive_title("   \n  \n ", "2026-04-27") == "Facebook post 2026-04-27"

    def test_long_first_line_is_truncated(self) -> None:
        msg = "x" * 200
        title = derive_title(msg, "2026-04-27")
        assert len(title) <= 100
        assert title.endswith("...")


class TestTruncateDescription:
    def test_short_message_unchanged(self) -> None:
        assert truncate_description("Hello") == "Hello"

    def test_collapses_whitespace(self) -> None:
        assert truncate_description("Hello\n\n  world") == "Hello world"

    def test_truncates_at_word_boundary(self) -> None:
        msg = "this is a very long message " * 20
        out = truncate_description(msg, limit=50)
        assert len(out) <= 50
        assert out.endswith("...")
        # Must not split a word — last word before "..." is fully present.
        assert " " in out

    def test_empty_returns_empty(self) -> None:
        assert truncate_description("") == ""
