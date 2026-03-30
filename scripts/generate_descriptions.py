#!/usr/bin/env python3
"""
Generate meta descriptions for posts missing them.

Creates 150-160 character descriptions from post content for SEO.
Uses body text + location + city to craft a concise description.

Usage:
  python3 scripts/generate_descriptions.py [--dry-run]
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

    fm = {}
    for line in fm_text.split('\n'):
        if ':' in line and not line.startswith(' ') and not line.startswith('-'):
            key, _, val = line.partition(':')
            key = key.strip()
            val = val.strip().strip("'\"")
            if val:
                fm[key] = val

    return fm, fm_text, body


def clean_body_text(body):
    """Extract clean text from markdown body."""
    # Remove images
    text = re.sub(r'!\[.*?\]\(.*?\)', '', body)
    text = re.sub(r'<img\s[^>]*>', '', text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove markdown links but keep text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove hashtags
    text = re.sub(r'#\S+', '', text)
    # Remove @mentions
    text = re.sub(r'@\S+', '', text)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def generate_description(fm, body):
    """Generate a meta description from post data."""
    title = fm.get('title', '')
    location = fm.get('location', '')
    city = fm.get('city', '')
    clean = clean_body_text(body)

    # Strategy 1: Use body text if substantial
    if len(clean) >= 50:
        desc = clean
        # Truncate to ~155 chars at word boundary
        if len(desc) > 155:
            desc = desc[:152].rsplit(' ', 1)[0] + '...'
        return desc

    # Strategy 2: Build from title + location
    parts = []
    if title and not title.startswith('Instagram Post'):
        parts.append(title)
    if location and city:
        parts.append(f"at {location} in {city}")
    elif location:
        parts.append(f"at {location}")
    elif city:
        parts.append(f"in {city}")

    if parts:
        desc = ' '.join(parts)
        if not desc.endswith('.'):
            desc += '.'
        if len(desc) > 155:
            desc = desc[:152].rsplit(' ', 1)[0] + '...'
        return desc

    return None


def process_file(filepath, dry_run=False):
    """Process a single file and add description if missing."""
    fm, fm_text, body = parse_post(filepath)
    if fm is None:
        return None

    # Skip if description field exists in the raw frontmatter
    if 'description' in fm_text:
        return None

    description = generate_description(fm, body)
    if not description:
        return None

    # Escape single quotes for YAML
    safe_desc = description.replace("'", "''")

    result = {
        'file': os.path.basename(filepath),
        'description': description,
    }

    if not dry_run:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Insert description after title in frontmatter
        # Find the title line and add description after it
        title_match = re.search(r'^title:.*$', content, re.MULTILINE)
        if title_match:
            insert_pos = title_match.end()
            content = (
                content[:insert_pos] +
                f"\ndescription: '{safe_desc}'" +
                content[insert_pos:]
            )

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

    return result


def main():
    parser = argparse.ArgumentParser(description='Generate meta descriptions for posts')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without applying')
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f"Scanning {len(files)} posts for missing descriptions...")

    results = []
    for filepath in files:
        result = process_file(filepath, dry_run=args.dry_run)
        if result:
            results.append(result)

    if not results:
        print("All posts already have descriptions.")
        return

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Generated {len(results)} descriptions:\n")
    # Show first 20 examples
    for r in results[:20]:
        print(f"  {r['file']}")
        print(f"    → {r['description']}")
        print()

    if len(results) > 20:
        print(f"  ... and {len(results) - 20} more\n")

    if args.dry_run:
        print(f"Run without --dry-run to apply {len(results)} descriptions.")


if __name__ == '__main__':
    main()
