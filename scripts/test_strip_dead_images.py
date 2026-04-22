"""Tests for strip_dead_images.py — the regex-heavy content cleaner.

Covers every pattern the script removes: markdown images, empty-alt Blogger
links, angle-bracket autolinks, bare URLs across the three dead-host forms,
and HTML <img> tags. Plus the blank-line collapse that runs at the end.

Run from repo root:
    python3 -m pytest scripts/test_strip_dead_images.py -v
"""
import pytest

from strip_dead_images import strip_dead_images


class TestMarkdownImages:
    def test_removes_markdown_image_with_dead_url(self):
        body = "Before\n![alt](https://thirstypig.com/wp-content/uploads/x.jpg)\nAfter"
        cleaned, count = strip_dead_images(body)
        assert "/wp-content/" not in cleaned
        assert count == 1

    def test_removes_markdown_image_with_title_and_dead_url(self):
        body = '![alt](https://bp.blogspot.com/x.jpg "caption")'
        cleaned, count = strip_dead_images(body)
        assert cleaned.strip() == ""
        assert count == 1

    def test_preserves_markdown_images_with_live_urls(self):
        body = "![alt](/images/posts/valid/x.jpg)"
        cleaned, count = strip_dead_images(body)
        assert cleaned == body
        assert count == 0

    def test_handles_multiple_images_in_one_body(self):
        body = (
            "First ![a](https://bp.blogspot.com/1.jpg) "
            "and ![b](/images/valid.jpg) "
            "and ![c](https://thirstypig.com/wp-content/uploads/2.jpg)"
        )
        cleaned, count = strip_dead_images(body)
        assert "blogspot.com" not in cleaned
        assert "wp-content" not in cleaned
        assert "/images/valid.jpg" in cleaned  # live image survives
        assert count == 2


class TestEmptyAltBloggerLinks:
    def test_removes_empty_alt_links_with_dead_urls(self):
        # Blogger legacy pattern: [](url) used as a standalone image
        body = "Some text [](https://bp.blogspot.com/x.jpg) more text"
        cleaned, count = strip_dead_images(body)
        assert "blogspot.com" not in cleaned
        assert count == 1

    def test_preserves_empty_alt_links_with_live_urls(self):
        body = "[](https://example.com/page)"
        cleaned, count = strip_dead_images(body)
        assert cleaned == body
        assert count == 0


class TestAutolinks:
    def test_removes_angle_bracket_autolink_with_dead_url(self):
        body = "See <https://thethirstypig.com/wp-content/uploads/foo.jpg> here"
        cleaned, count = strip_dead_images(body)
        assert "wp-content" not in cleaned
        assert count == 1

    def test_preserves_autolinks_with_live_urls(self):
        body = "<https://github.com/thirstypig>"
        cleaned, count = strip_dead_images(body)
        assert cleaned == body
        assert count == 0


class TestBareUrls:
    def test_removes_bare_wp_content_url(self):
        body = "Caption text https://thirstypig.com/wp-content/uploads/foo.jpg trailing"
        cleaned, count = strip_dead_images(body)
        assert "wp-content" not in cleaned
        assert count == 1

    def test_removes_bare_blogspot_url(self):
        body = "Some caption https://bp.blogspot.com/-abc123/foo.jpg goes here"
        cleaned, count = strip_dead_images(body)
        assert "blogspot.com" not in cleaned
        assert count == 1

    def test_preserves_bare_live_urls(self):
        body = "Follow us at https://instagram.com/thirstypig for updates"
        cleaned, count = strip_dead_images(body)
        assert cleaned == body
        assert count == 0


class TestHtmlImgTags:
    def test_removes_html_img_with_dead_src(self):
        body = '<img src="https://thirstypig.com/wp-content/x.jpg" alt="x" />'
        cleaned, count = strip_dead_images(body)
        assert "wp-content" not in cleaned
        assert count == 1

    def test_preserves_html_img_with_live_src(self):
        body = '<img src="/images/valid.jpg" alt="local" />'
        cleaned, count = strip_dead_images(body)
        assert cleaned == body
        assert count == 0

    def test_case_insensitive_html_img_matching(self):
        body = '<IMG SRC="https://bp.blogspot.com/x.jpg" />'
        cleaned, count = strip_dead_images(body)
        assert "blogspot" not in cleaned
        assert count == 1


class TestBlankLineCollapse:
    def test_collapses_three_or_more_newlines_to_two(self):
        body = "First\n\n\n\nSecond"
        cleaned, _ = strip_dead_images(body)
        # 3+ newlines → 2 newlines (paragraph break)
        assert cleaned == "First\n\nSecond"

    def test_preserves_single_and_double_newlines(self):
        body = "Line 1\nLine 2\n\nPara 2"
        cleaned, _ = strip_dead_images(body)
        assert cleaned == body


class TestMixedContent:
    def test_full_blog_post_style_cleanup(self):
        """Realistic scenario: old WordPress content with multiple patterns."""
        body = (
            "Had a great meal!\n\n"
            '![photo](https://bp.blogspot.com/old.jpg)\n\n'
            "The service was excellent. See more at\n"
            "<https://thirstypig.com/wp-content/uploads/menu.pdf>\n\n"
            '<img src="https://thethirstypig.com/wp-content/banner.jpg" />\n\n'
            "Verdict: would go back."
        )
        cleaned, count = strip_dead_images(body)
        assert count == 3  # 1 md image + 1 autolink + 1 html img
        assert "blogspot.com" not in cleaned
        assert "wp-content" not in cleaned
        # Real content survives
        assert "Had a great meal!" in cleaned
        assert "would go back" in cleaned
