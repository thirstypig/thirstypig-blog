#!/usr/bin/env python3
"""Mark posts with no valid images as draft: true.

Scans all markdown posts and sets draft: true when:
- No heroImage, no images array entries, AND no inline ![...](...)  in body
- OR all referenced images are missing from disk

Usage:
    python scripts/mark_imageless_drafts.py [--dry-run]
"""

import os
import re
import sys
import yaml

POSTS_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "content", "posts")
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "public")

INLINE_IMAGE_RE = re.compile(r"!\[.*?\]\(([^)]+)\)")
# Also catch HTML <img src="..."> tags
HTML_IMAGE_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)


def parse_frontmatter(filepath):
    """Parse YAML frontmatter and body from a markdown file."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    if not content.startswith("---"):
        return None, content, content

    end = content.index("---", 3)
    fm_text = content[3:end].strip()
    body = content[end + 3:].strip()
    try:
        fm = yaml.safe_load(fm_text)
    except yaml.YAMLError:
        return None, body, content
    return fm, body, content


DEAD_DOMAINS = [
    "thethirstypig.com",
    "thirstypig.com/wp-content",
    "www.thethirstypig.com",
    "www.thirstypig.com/wp-content",
    "blog.thethirstypig.com",
    "bp.blogspot.com",  # Google Blogger image CDN — returns 404
]


def image_exists(path):
    """Check if an image path resolves to a file on disk."""
    if not path:
        return False
    # Treat known-dead external URLs as broken
    for domain in DEAD_DOMAINS:
        if domain in path:
            return False
    # Other external URLs — assume valid (can't verify)
    if path.startswith(("http://", "https://", "data:")):
        return True
    # Paths in frontmatter are relative to public/
    full = os.path.join(PUBLIC_DIR, path.lstrip("/"))
    return os.path.isfile(full)


def get_image_refs(fm, body):
    """Collect all image references from frontmatter and body."""
    refs = []

    # heroImage
    hero = fm.get("heroImage")
    if hero:
        refs.append(("heroImage", hero))

    # images array
    for img in fm.get("images") or []:
        if img:
            refs.append(("images", img))

    # Inline markdown images
    for match in INLINE_IMAGE_RE.finditer(body):
        refs.append(("inline", match.group(1)))

    # HTML img tags
    for match in HTML_IMAGE_RE.finditer(body):
        refs.append(("html", match.group(1)))

    return refs


def set_draft_true(filepath):
    """Set draft: true in a post's frontmatter."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace draft: false with draft: true
    if "draft: false" in content:
        content = content.replace("draft: false", "draft: true", 1)
    elif "draft:" not in content:
        # Add draft: true before the closing ---
        idx = content.index("---", 3)
        content = content[:idx] + "draft: true\n" + content[idx:]

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("DRY RUN — no files will be modified\n")

    posts_dir = os.path.realpath(POSTS_DIR)
    files = sorted(f for f in os.listdir(posts_dir) if f.endswith(".md"))
    print(f"Scanning {len(files)} posts...\n")

    no_images = []       # Zero image references at all
    broken_images = []   # Has references but all are missing from disk
    already_draft = 0
    skipped_valid = 0

    for filename in files:
        filepath = os.path.join(posts_dir, filename)
        fm, body, _ = parse_frontmatter(filepath)
        if fm is None:
            continue

        # Skip posts already marked as draft
        if fm.get("draft") is True:
            already_draft += 1
            continue

        refs = get_image_refs(fm, body)

        if not refs:
            # Zero image references
            no_images.append(filename)
            if not dry_run:
                set_draft_true(filepath)
            continue

        # Check if ANY referenced image exists on disk
        valid = [r for r in refs if image_exists(r[1])]
        if not valid:
            broken_images.append((filename, [r[1] for r in refs]))
            if not dry_run:
                set_draft_true(filepath)
            continue

        skipped_valid += 1

    # Report
    print("=" * 60)
    print(f"RESULTS")
    print(f"  Total scanned:      {len(files)}")
    print(f"  Already draft:      {already_draft}")
    print(f"  Valid (kept):       {skipped_valid}")
    print(f"  No images at all:   {len(no_images)}")
    print(f"  Broken images only: {len(broken_images)}")
    print(f"  TOTAL marked draft: {len(no_images) + len(broken_images)}")
    print("=" * 60)

    if no_images:
        print(f"\n--- Posts with NO image references ({len(no_images)}) ---")
        for f in no_images[:30]:
            print(f"  {f}")
        if len(no_images) > 30:
            print(f"  ... and {len(no_images) - 30} more")

    if broken_images:
        print(f"\n--- Posts with BROKEN images only ({len(broken_images)}) ---")
        for f, paths in broken_images[:20]:
            print(f"  {f}")
            for p in paths[:3]:
                print(f"    missing: {p}")
        if len(broken_images) > 20:
            print(f"  ... and {len(broken_images) - 20} more")

    if dry_run:
        print(f"\nDRY RUN complete. Run without --dry-run to apply changes.")
    else:
        print(f"\nDone. {len(no_images) + len(broken_images)} posts marked as draft: true")


if __name__ == "__main__":
    main()
