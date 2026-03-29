#!/usr/bin/env python3
"""
Strip dead wp.com Photon CDN image references from blog post markdown.

These images return 403 Forbidden — they were never archived by the Wayback Machine
and are permanently lost. Removing the references eliminates console errors and
unnecessary network requests.
"""

import glob
import os
import re

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')

# Patterns for dead image URLs
DEAD_URL_PATTERN = r'i[0-9]\.wp\.com'

def strip_dead_images(content: str) -> tuple[str, int]:
    """Remove dead wp.com image references from markdown content.

    Returns (cleaned_content, count_removed).
    """
    count = 0
    lines = content.split('\n')
    cleaned = []

    for line in lines:
        # Skip lines that are purely a dead image reference
        # Pattern 1: [![alt](dead-url "title")](link) — clickable image
        # Pattern 2: ![alt](dead-url) — plain image
        # Pattern 3: <img src="dead-url" ...> — HTML image tag

        if re.search(DEAD_URL_PATTERN, line):
            # Check if the entire line is just an image reference (possibly with whitespace)
            stripped = line.strip()

            # Clickable image: [![...](wp.com...)](...)
            if re.match(r'^\[!\[.*?\]\(https?://i[0-9]\.wp\.com/.*?\)\]\(.*?\)$', stripped):
                count += 1
                continue

            # Plain image: ![...](wp.com...)
            if re.match(r'^!\[.*?\]\(https?://i[0-9]\.wp\.com/.*?\)$', stripped):
                count += 1
                continue

            # HTML img tag
            if re.match(r'^<img\s+.*?src=["\']https?://i[0-9]\.wp\.com/.*?["\'].*?/?>$', stripped):
                count += 1
                continue

            # Line contains dead URL mixed with other content — remove just the image part
            # Remove clickable image pattern inline
            new_line, n = re.subn(
                r'\[!\[.*?\]\(https?://i[0-9]\.wp\.com/[^)]*\)\]\([^)]*\)',
                '', line
            )
            count += n
            # Remove plain image pattern inline
            new_line, n = re.subn(
                r'!\[.*?\]\(https?://i[0-9]\.wp\.com/[^)]*\)',
                '', new_line
            )
            count += n
            # Remove HTML img tags inline
            new_line, n = re.subn(
                r'<img\s+[^>]*src=["\']https?://i[0-9]\.wp\.com/[^"\']*["\'][^>]*/?>',
                '', new_line
            )
            count += n

            # Only keep the line if there's meaningful content left
            if new_line.strip():
                cleaned.append(new_line)
            else:
                pass  # drop empty line
        else:
            cleaned.append(line)

    # Collapse 3+ consecutive blank lines into 2
    result = '\n'.join(cleaned)
    result = re.sub(r'\n{4,}', '\n\n\n', result)

    return result, count


def main():
    print('=' * 60)
    print('  STRIP DEAD WP.COM IMAGE REFERENCES')
    print('=' * 60)

    md_files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f'Scanning {len(md_files)} posts...\n')

    total_files = 0
    total_images = 0

    for path in md_files:
        with open(path, encoding='utf-8') as f:
            content = f.read()

        if not re.search(DEAD_URL_PATTERN, content):
            continue

        # Split frontmatter from body
        parts = content.split('---', 2)
        if len(parts) < 3:
            continue

        body = parts[2]
        cleaned_body, removed = strip_dead_images(body)

        if removed > 0:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(parts[0])
                f.write('---')
                f.write(parts[1])
                f.write('---')
                f.write(cleaned_body)

            total_files += 1
            total_images += removed
            print(f'  {os.path.basename(path)}: removed {removed} dead images')

    print(f'\nResults:')
    print(f'  Files updated: {total_files}')
    print(f'  Dead image references removed: {total_images}')
    print(f'\nDone!')


if __name__ == '__main__':
    main()
