#!/usr/bin/env python3
"""Strip dead image references from post content.

Removes:
- Markdown images: ![alt](dead-url) or ![alt](dead-url "title")
- HTML img tags: <img src="dead-url" .../>
- WordPress plugin artifacts (google-ajax-translation, add-to-any icons)

Does NOT remove:
- Links to dead URLs (only images)
- URLs in frontmatter fields (originalUrl, archiveUrl — those are references)

Usage:
    python scripts/strip_dead_images.py [--dry-run]
"""

import os
import re
import sys

POSTS_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "content", "posts")

DEAD_DOMAINS = [
    "thethirstypig.com/wp-content",
    "thirstypig.com/wp-content",
    "www.thethirstypig.com/wp-content",
    "www.thirstypig.com/wp-content",
    "blog.thethirstypig.com/wp-content",
    "bp.blogspot.com",
]


def is_dead_url(url):
    """Check if a URL matches a known-dead domain."""
    for domain in DEAD_DOMAINS:
        if domain in url:
            return True
    return False


def strip_dead_images(body):
    """Remove dead image references from markdown body. Returns (cleaned_body, count)."""
    count = 0

    # 1. Markdown images: ![alt](url) or ![alt](url "title")
    def replace_md_img(m):
        nonlocal count
        url = m.group(1)
        if is_dead_url(url):
            count += 1
            return ""
        return m.group(0)

    body = re.sub(r'!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)', replace_md_img, body)

    # 1b. Empty-alt links used as images in old Blogger: [](url)
    def replace_empty_link(m):
        nonlocal count
        url = m.group(1)
        if is_dead_url(url):
            count += 1
            return ""
        return m.group(0)

    body = re.sub(r'\[\]\(([^)\s]+)\)', replace_empty_link, body)

    # 1c. Angle-bracket autolinks to dead URLs: <http://dead-url>
    def replace_autolink(m):
        nonlocal count
        url = m.group(1)
        if is_dead_url(url):
            count += 1
            return ""
        return m.group(0)

    body = re.sub(r'<(https?://[^>]+)>', replace_autolink, body)

    # 1d. Bare dead URLs on their own or inline (markdown link targets already handled)
    def replace_bare_url(m):
        nonlocal count
        url = m.group(0)
        if is_dead_url(url):
            count += 1
            return ""
        return m.group(0)

    body = re.sub(r'https?://[^\s)<\]]+thethirstypig\.com/wp-content[^\s)<\]]*', replace_bare_url, body)
    body = re.sub(r'https?://[^\s)<\]]+thirstypig\.com/wp-content[^\s)<\]]*', replace_bare_url, body)
    body = re.sub(r'https?://[^\s)<\]]*bp\.blogspot\.com[^\s)<\]]*', replace_bare_url, body)

    # 2. HTML img tags: <img ... src="url" ... />
    def replace_html_img(m):
        nonlocal count
        src = re.search(r'src=["\']([^"\']+)["\']', m.group(0))
        if src and is_dead_url(src.group(1)):
            count += 1
            return ""
        return m.group(0)

    body = re.sub(r'<img[^>]+/?>', replace_html_img, body, flags=re.IGNORECASE)

    # 3. Clean up leftover blank lines (3+ consecutive newlines -> 2)
    body = re.sub(r'\n{3,}', '\n\n', body)

    return body, count


def process_file(filepath, dry_run=False):
    """Process a single markdown file. Returns number of removals."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Split frontmatter from body
    if not content.startswith("---"):
        return 0

    end = content.index("---", 3)
    frontmatter = content[:end + 3]
    body = content[end + 3:]

    # Clean body
    cleaned_body, count = strip_dead_images(body)

    # Clean dead URLs from description field in frontmatter
    cleaned_fm = frontmatter
    desc_match = re.search(r"^(description:\s*)(.*)", frontmatter, re.MULTILINE)
    if desc_match:
        desc_val = desc_match.group(2)
        # Strip dead URLs from description
        for pattern in [
            r'https?://[^\s]*thethirstypig\.com/wp-content[^\s]*',
            r'https?://[^\s]*thirstypig\.com/wp-content[^\s]*',
            r'https?://[^\s]*bp\.blogspot\.com[^\s]*',
        ]:
            old_desc = desc_val
            desc_val = re.sub(pattern, '', desc_val)
            if desc_val != old_desc:
                count += 1
        desc_val = re.sub(r'\s{2,}', ' ', desc_val).strip()
        cleaned_fm = frontmatter[:desc_match.start(2)] + desc_val + frontmatter[desc_match.end(2):]

    if count > 0 and not dry_run:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(cleaned_fm + cleaned_body)

    return count


def main():
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("DRY RUN — no files will be modified\n")

    posts_dir = os.path.realpath(POSTS_DIR)
    files = sorted(f for f in os.listdir(posts_dir) if f.endswith(".md"))
    print(f"Scanning {len(files)} posts...\n")

    total_removed = 0
    affected_files = []

    for filename in files:
        filepath = os.path.join(posts_dir, filename)
        count = process_file(filepath, dry_run)
        if count > 0:
            affected_files.append((filename, count))
            total_removed += count

    print("=" * 60)
    print(f"RESULTS")
    print(f"  Files scanned:    {len(files)}")
    print(f"  Files affected:   {len(affected_files)}")
    print(f"  Images removed:   {total_removed}")
    print("=" * 60)

    if affected_files:
        print(f"\n--- Affected files ---")
        for f, c in affected_files:
            print(f"  {f} ({c} images removed)")

    if dry_run:
        print(f"\nDRY RUN complete. Run without --dry-run to apply changes.")
    else:
        print(f"\nDone. Removed {total_removed} dead image references from {len(affected_files)} files.")


if __name__ == "__main__":
    main()
