"""Tests for mark_imageless_drafts.py — the script that drafts posts whose
images are all dead/missing.

Focus on the pure logic (image_exists routing + get_image_refs collection).
The set_draft_true file-mutation path is exercised indirectly through
the pre-commit validate-hitlist gate and the existing dry-run flow.

Run from repo root:
    python3 -m pytest scripts/test_mark_imageless_drafts.py -v
"""
import pytest

from mark_imageless_drafts import image_exists, get_image_refs


class TestImageExists:
    def test_returns_false_for_empty_or_none(self):
        assert image_exists("") is False
        assert image_exists(None) is False

    def test_returns_false_for_known_dead_wp_content_url(self):
        assert image_exists("https://thirstypig.com/wp-content/uploads/foo.jpg") is False

    def test_returns_false_for_known_dead_blogspot_cdn_url(self):
        assert image_exists("https://bp.blogspot.com/-abc/foo.jpg") is False

    def test_returns_false_for_legacy_blog_domain(self):
        # thethirstypig.com (with "the") is the dead WordPress; images there are gone
        assert image_exists("https://thethirstypig.com/old/img.png") is False

    def test_returns_true_for_unknown_external_url(self):
        # Unknown externals we can't verify — assume valid
        assert image_exists("https://images.example.com/foo.jpg") is True
        assert image_exists("https://cdn.some-cdn.net/pic.png") is True

    def test_returns_true_for_data_url(self):
        assert image_exists("data:image/png;base64,iVBORw0KGgo=") is True

    def test_returns_true_for_live_local_file(self):
        # The SVG logo definitely exists in public/images/
        assert image_exists("/images/thirstypig-logo.svg") is True

    def test_returns_false_for_missing_local_file(self):
        assert image_exists("/images/posts/nonexistent-slug/nothing.jpg") is False


class TestGetImageRefs:
    def test_collects_hero_image_from_frontmatter(self):
        refs = get_image_refs({"heroImage": "/images/x.jpg"}, "")
        assert ("heroImage", "/images/x.jpg") in refs

    def test_collects_images_array_from_frontmatter(self):
        refs = get_image_refs({"images": ["/a.jpg", "/b.jpg"]}, "")
        assert ("images", "/a.jpg") in refs
        assert ("images", "/b.jpg") in refs
        assert len(refs) == 2

    def test_collects_inline_markdown_images_from_body(self):
        body = "Before ![alt](/images/inline.jpg) after"
        refs = get_image_refs({}, body)
        assert ("inline", "/images/inline.jpg") in refs

    def test_collects_html_img_tags_from_body(self):
        body = 'Text <img src="/images/tagged.jpg" alt="x" /> more'
        refs = get_image_refs({}, body)
        assert ("html", "/images/tagged.jpg") in refs

    def test_combines_all_sources(self):
        fm = {
            "heroImage": "/hero.jpg",
            "images": ["/gal1.jpg", "/gal2.jpg"],
        }
        body = '![a](/inline.jpg) and <img src="/htmltag.jpg">'
        refs = get_image_refs(fm, body)
        paths = [p for _, p in refs]
        for expected in ["/hero.jpg", "/gal1.jpg", "/gal2.jpg", "/inline.jpg", "/htmltag.jpg"]:
            assert expected in paths

    def test_handles_missing_fields_gracefully(self):
        # No heroImage, no images array, no body content
        refs = get_image_refs({}, "")
        assert refs == []

    def test_skips_none_hero_image(self):
        refs = get_image_refs({"heroImage": None}, "")
        assert refs == []

    def test_skips_empty_strings_in_images_array(self):
        refs = get_image_refs({"images": ["", "/good.jpg", None]}, "")
        # Only the valid entry should come through
        paths = [p for _, p in refs]
        assert "/good.jpg" in paths
        assert "" not in paths
