"""Tests for post_utils.py — the shared frontmatter + dead-URL helpers
used by mark_imageless_drafts.py and strip_dead_images.py.

The primary reason this module exists is that both scripts used
content.index("---", 3) which crashes on malformed frontmatter. These tests
lock that crash-free behavior in place.

Run from repo root:
    python3 -m pytest scripts/test_post_utils.py -v
"""

import pytest

from post_utils import (
    DEAD_BLOG_DOMAINS,
    DEAD_WP_CONTENT_DOMAINS,
    frontmatter_close_index,
    is_dead_image_url,
    is_dead_wp_content_url,
)


class TestFrontmatterCloseIndex:
    def test_returns_minus_one_when_no_opening_delimiter(self):
        assert frontmatter_close_index("no frontmatter here") == -1
        assert frontmatter_close_index("") == -1

    def test_returns_minus_one_when_no_closing_delimiter(self):
        """Key regression test for the P1 crash — previously raised ValueError."""
        content = "---\ntitle: Stuck\nauthor: Nobody\n(never closed)"
        assert frontmatter_close_index(content) == -1

    def test_finds_closing_delimiter_at_newline(self):
        content = "---\ntitle: Valid\n---\n\nBody text.\n"
        idx = frontmatter_close_index(content)
        # Index should point to the first '-' of the closing '---'
        assert content[idx:idx + 3] == "---"

    def test_anchors_on_newline_so_stray_dashes_in_values_dont_split_early(self):
        """If a field value contains '---', we should still find the real closing delimiter."""
        content = "---\ntitle: An em-dash: --- inline\nauthor: X\n---\n\nBody.\n"
        idx = frontmatter_close_index(content)
        # The real close is AFTER the inline --- stray
        # Position check: content[idx-1] should be '\n', content[idx:idx+3] should be '---'
        assert content[idx - 1] == "\n"
        assert content[idx:idx + 3] == "---"
        # And the stray --- should come BEFORE this idx
        stray_idx = content.index("---", 3)
        assert stray_idx < idx  # The old buggy behavior would have used stray_idx


class TestIsDeadWpContentUrl:
    @pytest.mark.parametrize("url", [
        "https://thirstypig.com/wp-content/uploads/foo.jpg",
        "http://www.thethirstypig.com/wp-content/uploads/bar.jpg",
        "https://blog.thethirstypig.com/wp-content/uploads/baz.jpg",
        "https://bp.blogspot.com/someimage.jpg",
    ])
    def test_matches_known_dead_wp_content_urls(self, url):
        assert is_dead_wp_content_url(url) is True

    @pytest.mark.parametrize("url", [
        "https://thirstypig.com/",                          # bare domain — content-stripping must NOT match
        "https://www.thethirstypig.com/some-post/",         # bare domain
        "https://unrelated-site.com/wp-content/uploads/",   # wp-content on a different site
        "https://instagram.com/thirstypig/",
        "",
    ])
    def test_does_not_match_non_dead_urls(self, url):
        assert is_dead_wp_content_url(url) is False

    def test_narrow_match_is_what_makes_stripping_safe(self):
        """Explicit doc of the design choice — bare domains must NOT match here
        because strip_dead_images would delete descriptive mentions of the
        old domain in post bodies. See project_post_manager.md."""
        assert is_dead_wp_content_url("thirstypig.com was our old site") is False
        assert is_dead_wp_content_url("thirstypig.com/wp-content/uploads/x.jpg") is True


class TestIsDeadImageUrl:
    def test_matches_wp_content_urls(self):
        assert is_dead_image_url("https://thirstypig.com/wp-content/uploads/x.jpg") is True

    def test_also_matches_bare_legacy_domains(self):
        """This is the broader matcher — for image-existence checks,
        any image hosted on the old legacy blog domain is dead. Note:
        `thirstypig.com` (no 'the') is the CURRENT live site, not dead."""
        assert is_dead_image_url("https://thethirstypig.com/some/image.jpg") is True
        assert is_dead_image_url("https://www.thethirstypig.com/image.png") is True
        assert is_dead_image_url("https://blog.thethirstypig.com/pic.gif") is True

    def test_does_not_match_current_cdn_or_external_sites(self):
        assert is_dead_image_url("/images/posts/foo/bar.jpg") is False  # local
        assert is_dead_image_url("https://example.com/image.jpg") is False
        assert is_dead_image_url("https://cdn.instagram.com/foo.jpg") is False

    def test_does_not_match_current_live_domain(self):
        """Regression guard: thirstypig.com (the current primary) must NOT
        be treated as dead. Only thethirstypig.com (with 'the') is the old
        WordPress install. A test-driven discovery from PR #12."""
        assert is_dead_image_url("https://thirstypig.com/image.jpg") is False
        # But old /wp-content paths on thirstypig.com ARE dead —
        # the site is live but the WordPress media serving isn't
        assert is_dead_image_url("https://thirstypig.com/wp-content/uploads/x.jpg") is True


class TestDeadDomainListsStructure:
    """Meta-test guarding the intentional-but-subtle distinction between
    the two lists. If someone collapses them, these tests fail loudly."""

    def test_wp_content_list_is_strict_subset_in_theory(self):
        """Every entry in DEAD_WP_CONTENT_DOMAINS has `/wp-content` or is a known CDN."""
        for domain in DEAD_WP_CONTENT_DOMAINS:
            assert "/wp-content" in domain or "blogspot.com" in domain, \
                f"{domain!r} looks too broad for content stripping"

    def test_blog_list_contains_only_bare_hosts(self):
        """DEAD_BLOG_DOMAINS must not contain /wp-content patterns (that's the other list's job)."""
        for domain in DEAD_BLOG_DOMAINS:
            assert "/wp-content" not in domain, \
                f"{domain!r} belongs in DEAD_WP_CONTENT_DOMAINS, not DEAD_BLOG_DOMAINS"
