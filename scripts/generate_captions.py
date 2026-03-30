#!/usr/bin/env python3
"""
Generate short captions for image-only posts (no body text).

Uses frontmatter data (location, city, categories, cuisine) to create
a brief one-line caption. Keeps it short and casual.

Usage:
  python3 scripts/generate_captions.py [--dry-run]
"""

import argparse
import glob
import os
import re

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')


def parse_post(filepath):
    """Parse frontmatter and body from markdown file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not content.startswith('---'):
        return None, None, content

    end = content.index('---', 3)
    fm_text = content[3:end].strip()
    body = content[end + 3:].strip()

    # Parse frontmatter
    fm = {}
    current_key = None
    list_values = []

    for line in fm_text.split('\n'):
        stripped = line.strip()
        if stripped.startswith('- ') and current_key:
            val = stripped[2:].strip().strip("'\"")
            if val:
                list_values.append(val)
            fm[current_key] = list_values
            continue

        if ':' in line and not line.startswith(' ') and not line.startswith('-'):
            if current_key and isinstance(fm.get(current_key), list):
                pass  # already saved
            key, _, val = line.partition(':')
            key = key.strip()
            val = val.strip().strip("'\"")
            current_key = key
            list_values = []
            if val:
                fm[key] = val

    return fm, fm_text, body


def is_body_empty(body):
    """Check if body has no meaningful text (only images, whitespace, or nothing)."""
    if not body:
        return True

    # Remove image references
    cleaned = re.sub(r'!\[.*?\]\(.*?\)', '', body)
    # Remove HTML img tags
    cleaned = re.sub(r'<img\s[^>]*>', '', cleaned)
    # Remove whitespace
    cleaned = cleaned.strip()

    return len(cleaned) == 0


def generate_caption(fm):
    """Generate a short caption from frontmatter data."""
    location = fm.get('location', '').strip()
    city = fm.get('city', '').strip()
    categories = fm.get('categories', [])
    cuisine = fm.get('cuisine', [])

    if isinstance(categories, str):
        categories = [categories]
    if isinstance(cuisine, str):
        cuisine = [cuisine]

    parts = []

    # Build caption
    if location and city:
        parts.append(f"{location} in {city}.")
    elif location:
        parts.append(f"{location}.")
    elif city:
        if cuisine:
            parts.append(f"{cuisine[0]} in {city}.")
        elif categories:
            parts.append(f"{categories[0]} in {city}.")
        else:
            parts.append(f"Dining in {city}.")
    else:
        if cuisine:
            parts.append(f"{cuisine[0]}.")
        elif categories:
            parts.append(f"{categories[0]}.")
        else:
            return None  # Not enough data for a caption

    return ' '.join(parts)


def process_file(filepath, dry_run=False):
    """Process a single file and add caption if body is empty."""
    fm, fm_text, body = parse_post(filepath)
    if fm is None:
        return None

    if not is_body_empty(body):
        return None

    caption = generate_caption(fm)
    if not caption:
        return None

    result = {
        'file': os.path.basename(filepath),
        'caption': caption,
    }

    if not dry_run:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find end of frontmatter and insert caption
        end = content.index('---', 3) + 3
        existing_body = content[end:]

        # Check if there are existing image embeds to preserve
        images_section = ''
        if '![' in existing_body or '<img' in existing_body:
            images_section = existing_body.rstrip() + '\n'

        new_content = content[:end] + '\n\n' + caption + '\n' + images_section
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

    return result


def main():
    parser = argparse.ArgumentParser(description='Generate captions for image-only posts')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without applying')
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f"Scanning {len(files)} posts for image-only content...")

    results = []
    for filepath in files:
        result = process_file(filepath, dry_run=args.dry_run)
        if result:
            results.append(result)

    if not results:
        print("No image-only posts need captions.")
        return

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Generated {len(results)} captions:\n")
    for r in results:
        print(f"  {r['file']}")
        print(f"    → {r['caption']}")
        print()

    if args.dry_run:
        print(f"Run without --dry-run to apply {len(results)} captions.")


if __name__ == '__main__':
    main()
