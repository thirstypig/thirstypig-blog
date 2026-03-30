#!/usr/bin/env python3
"""
Fix generic and truncated post titles.

Replaces:
  - "Instagram Post — [Date]" titles → "Venue Name, City" or best available
  - Truncated titles ending in "..." → completed from body content
  - Double/triple spaces → single space

Usage:
  python3 scripts/fix_titles.py [--dry-run]
"""

import argparse
import glob
import os
import re
import sys

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')

# Pattern for generic Instagram titles
GENERIC_TITLE_RE = re.compile(r'^Instagram Post\s*[—–-]\s*\w+\s+\d{1,2},?\s*\d{4}$', re.IGNORECASE)


def parse_frontmatter(filepath):
    """Parse YAML frontmatter and body from a markdown file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not content.startswith('---'):
        return None, None, content

    end = content.index('---', 3)
    fm_text = content[3:end].strip()
    body = content[end + 3:].strip()

    # Simple YAML parsing for the fields we need
    fm = {}
    for line in fm_text.split('\n'):
        if ':' in line and not line.startswith(' ') and not line.startswith('-'):
            key, _, val = line.partition(':')
            key = key.strip()
            val = val.strip().strip("'\"")
            if val:
                fm[key] = val

    return fm, fm_text, body


def generate_title(fm, body):
    """Generate a clean title from frontmatter fields."""
    location = fm.get('location', '').strip()
    city = fm.get('city', '').strip()

    if location and city:
        return f"{location}, {city}"
    if location:
        return location
    if city:
        # Try to extract a venue from body
        venue = extract_venue_from_body(body)
        if venue:
            return f"{venue}, {city}"
        return city

    # Last resort: extract from body
    venue = extract_venue_from_body(body)
    if venue:
        return venue

    return None


def extract_venue_from_body(body):
    """Try to extract a venue/restaurant name from the post body."""
    if not body:
        return None

    # Look for @mentions (often venue handles)
    mentions = re.findall(r'@([a-zA-Z0-9._]{3,30})', body)
    if mentions:
        # Skip common non-venue handles
        skip = {'instagram', 'thethirstypig', 'thirstypig', 'isliou'}
        handle = None
        for m in mentions:
            if m.lower() not in skip:
                handle = m
                break

        if handle:
            # Split camelCase and insert spaces before capitals
            name = re.sub(r'([a-z])([A-Z])', r'\1 \2', handle)
            # Split on dots/underscores
            name = re.sub(r'[._]', ' ', name)
            # Insert spaces between letters and numbers
            name = re.sub(r'([a-zA-Z])(\d)', r'\1 \2', name)
            name = re.sub(r'(\d)([a-zA-Z])', r'\1 \2', name)
            return name.title()

    # Look for "at [Place Name]" pattern
    at_match = re.search(r'\bat\s+([A-Z][A-Za-z\s&\']+)', body)
    if at_match:
        venue = at_match.group(1).strip()
        # Cap at ~40 chars
        if len(venue) <= 40:
            return venue

    # First sentence, truncated
    first_line = body.split('\n')[0].strip()
    if first_line and len(first_line) <= 60:
        # Remove trailing hashtags
        first_line = re.sub(r'\s*#\S+.*$', '', first_line).strip()
        if first_line:
            return first_line

    return None


def fix_title_text(title):
    """Fix spacing and basic formatting issues in a title."""
    # Fix double/triple spaces
    title = re.sub(r'\s{2,}', ' ', title)
    # Remove trailing ellipsis and whitespace
    title = title.rstrip('. ')
    # Cap length at 70 chars
    if len(title) > 70:
        # Try to break at a word boundary
        title = title[:67].rsplit(' ', 1)[0] + '...'
    return title.strip()


def process_file(filepath, dry_run=False):
    """Process a single file and fix its title if needed."""
    fm, fm_text, body = parse_frontmatter(filepath)
    if fm is None:
        return None

    title = fm.get('title', '')
    original_title = title
    changed = False

    # Case 1: Generic "Instagram Post — [Date]" title
    if GENERIC_TITLE_RE.match(title):
        new_title = generate_title(fm, body)
        if new_title:
            title = fix_title_text(new_title)
            changed = True

    # Case 2: Truncated title ending in "..."
    elif title.endswith('...') or title.endswith('…'):
        # Just fix the spacing/truncation, keep the existing content
        title = fix_title_text(title)
        if title != original_title:
            changed = True

    # Case 3: Double spaces in title
    elif '  ' in title:
        title = fix_title_text(title)
        if title != original_title:
            changed = True

    if not changed:
        return None

    result = {
        'file': os.path.basename(filepath),
        'old': original_title,
        'new': title,
    }

    if not dry_run:
        # Read the full file and do a precise replacement
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Replace the title in frontmatter (handle both quoted and unquoted)
        old_patterns = [
            f"title: '{original_title}'",
            f'title: "{original_title}"',
            f'title: {original_title}',
        ]
        new_val = f"title: '{title}'" if "'" not in title else f'title: "{title}"'

        for pattern in old_patterns:
            if pattern in content:
                content = content.replace(pattern, new_val, 1)
                break

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return result


def main():
    parser = argparse.ArgumentParser(description='Fix generic and truncated post titles')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without applying')
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f"Scanning {len(files)} posts...")

    changes = []
    for filepath in files:
        result = process_file(filepath, dry_run=args.dry_run)
        if result:
            changes.append(result)

    if not changes:
        print("No title changes needed.")
        return

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Fixed {len(changes)} titles:\n")
    for c in changes:
        print(f"  {c['file']}")
        print(f"    OLD: {c['old']}")
        print(f"    NEW: {c['new']}")
        print()

    if args.dry_run:
        print(f"Run without --dry-run to apply {len(changes)} changes.")


if __name__ == '__main__':
    main()
