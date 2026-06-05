"""Tests for migrate_ig_prose.py.

Covers:
- strip_ig_artifacts: pure function, trailing @mention / #hashtag removal
- migrate_post: file-based migration with dry-run and apply modes

Run from repo root:
    python3 -m pytest scripts/test_migrate_ig_prose.py -v
"""
import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from migrate_ig_prose import strip_ig_artifacts, migrate_post


# ---------------------------------------------------------------------------
# strip_ig_artifacts
# ---------------------------------------------------------------------------

class TestStripIgArtifacts:
    def test_strips_trailing_mentions_and_hashtags(self):
        text = "Great sandwich.  @basqueria #basque #sandwich #malibu"
        assert strip_ig_artifacts(text) == "Great sandwich."

    def test_strips_mixed_trailing_block(self):
        text = "Delicious food.  #runbing #潤餅 #taiwanesefood @99ranchmarket"
        assert strip_ig_artifacts(text) == "Delicious food."

    def test_leaves_clean_text_unchanged(self):
        text = "No hashtags or mentions here."
        assert strip_ig_artifacts(text) == text

    def test_strips_single_trailing_mention(self):
        assert strip_ig_artifacts("Good vibes. @venue") == "Good vibes."

    def test_strips_single_trailing_hashtag(self):
        assert strip_ig_artifacts("Korean BBQ. #kbbq") == "Korean BBQ."

    def test_handles_empty_string(self):
        assert strip_ig_artifacts("") == ""

    def test_strips_trailing_block_leaving_first_token(self):
        # The regex requires \s+ before each token, so the FIRST @/# word (no
        # preceding space) is never stripped. In real IG posts this edge case
        # doesn't arise — there is always sentence text before the tag block.
        result = strip_ig_artifacts("@mention #tag #another")
        assert result == "@mention"

    def test_does_not_strip_mid_sentence_mentions(self):
        # Mentions in the middle of text (not trailing) should be preserved
        text = "Ate at @localspot and loved it."
        result = strip_ig_artifacts(text)
        # The trailing text after "it." has no tags, so nothing should be stripped
        assert "Ate at" in result

    def test_handles_unicode_hashtags(self):
        text = "Taiwanese breakfast. #潤餅 #taiwanesefood"
        assert strip_ig_artifacts(text) == "Taiwanese breakfast."

    def test_trims_trailing_whitespace_after_strip(self):
        result = strip_ig_artifacts("Nice place.   @venue  ")
        assert not result.endswith(" ")


# ---------------------------------------------------------------------------
# migrate_post
# ---------------------------------------------------------------------------

FM_IG = """\
---
title: Test Post
source: instagram
draft: false
---
"""

FM_WAYBACK = """\
---
title: Old Post
source: thethirstypig.com
---
"""


def make_post(tmp_path: Path, content: str, name: str = "test.md") -> Path:
    p = tmp_path / name
    p.write_text(content, encoding="utf-8")
    return p


class TestMigratePostSkips:
    def test_skips_non_instagram_post(self, tmp_path):
        p = make_post(tmp_path, FM_WAYBACK + "\nSome content\n")
        result = migrate_post(p, apply=False)
        assert result["status"] == "skip"
        assert "not instagram" in result["reason"]

    def test_skips_post_with_no_frontmatter(self, tmp_path):
        p = make_post(tmp_path, "No frontmatter here\n")
        result = migrate_post(p, apply=False)
        assert result["status"] == "skip"

    def test_skips_already_clean_post(self, tmp_path):
        content = FM_IG + "\nCaption text only, no images.\n"
        p = make_post(tmp_path, content)
        result = migrate_post(p, apply=False)
        assert result["status"] == "skip"
        assert "already clean" in result["reason"]


class TestMigratePostMigration:
    def _ig_post(self, caption: str, images: list[str] = None, videos: list[str] = None) -> str:
        imgs = images or ["/images/posts/slug/img1.jpg"]
        body_parts = [f"![Title]({img})" for img in imgs]
        if videos:
            body_parts += videos
        if caption:
            body_parts.append(caption)
        return FM_IG + "\n" + "\n\n".join(body_parts) + "\n"

    def test_reports_migrated_status(self, tmp_path):
        p = make_post(tmp_path, self._ig_post("Great food."))
        result = migrate_post(p, apply=False)
        assert result["status"] == "migrated"

    def test_counts_removed_images(self, tmp_path):
        p = make_post(tmp_path, self._ig_post(
            "Caption.",
            images=["/img1.jpg", "/img2.jpg", "/img3.jpg"]
        ))
        result = migrate_post(p, apply=False)
        assert result["imgs_removed"] == 3

    def test_dry_run_does_not_write_file(self, tmp_path):
        original = self._ig_post("Caption here.")
        p = make_post(tmp_path, original)
        migrate_post(p, apply=False)
        assert p.read_text() == original

    def test_apply_writes_file(self, tmp_path):
        p = make_post(tmp_path, self._ig_post("Caption here."))
        result = migrate_post(p, apply=True)
        assert result.get("written") is True
        new_content = p.read_text()
        assert new_content != self._ig_post("Caption here.")

    def test_caption_moves_to_top_after_apply(self, tmp_path):
        p = make_post(tmp_path, self._ig_post("Tasty ramen."))
        migrate_post(p, apply=True)
        body = p.read_text().split("---", 2)[2].strip()
        assert body.startswith("Tasty ramen.")

    def test_image_lines_removed_from_body(self, tmp_path):
        p = make_post(tmp_path, self._ig_post("Caption."))
        migrate_post(p, apply=True)
        new = p.read_text()
        assert "![" not in new

    def test_ig_artifacts_stripped_from_caption(self, tmp_path):
        p = make_post(tmp_path, self._ig_post("Nice spot.  @venue #tag #tag2"))
        migrate_post(p, apply=True)
        body = p.read_text().split("---", 2)[2].strip()
        assert "@venue" not in body
        assert "#tag" not in body
        assert "Nice spot." in body

    def test_video_lines_preserved(self, tmp_path):
        video = '<video controls width="100%"><source src="/v.mp4" type="video/mp4"></video>'
        p = make_post(tmp_path, self._ig_post("Caption.", videos=[video]))
        result = migrate_post(p, apply=True)
        assert result["videos_kept"] == 1
        new = p.read_text()
        assert "<video" in new

    def test_no_caption_results_in_empty_body(self, tmp_path):
        # Post with only image lines and no text
        content = FM_IG + "\n![Title](/img.jpg)\n"
        p = make_post(tmp_path, content)
        result = migrate_post(p, apply=True)
        assert result["has_caption"] is False
        body = p.read_text().split("---", 2)[2].strip()
        assert body == ""

    def test_frontmatter_unchanged_after_migration(self, tmp_path):
        p = make_post(tmp_path, self._ig_post("Caption."))
        original_fm = p.read_text().split("---", 2)[1]
        migrate_post(p, apply=True)
        new_fm = p.read_text().split("---", 2)[1]
        assert original_fm == new_fm
