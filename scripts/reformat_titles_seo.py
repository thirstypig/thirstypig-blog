#!/usr/bin/env python3
"""
Reformat post titles for SEO: "Dish at Venue, City" format.

Strategy:
  - If location + city exist: "[Title context] at [Location], [City]"
  - If only location: "[Location]"
  - If only city: "[Title], [City]"
  - Skip posts already in good format
  - Max 60 characters (Google truncation point)

Usage:
  python3 scripts/reformat_titles_seo.py [--dry-run]
"""

import argparse
import glob
import os
import re

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')


def parse_frontmatter(filepath):
    """Parse YAML frontmatter from markdown file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not content.startswith('---'):
        return None, content

    end = content.index('---', 3)
    fm_text = content[3:end].strip()

    fm = {}
    for line in fm_text.split('\n'):
        if ':' in line and not line.startswith(' ') and not line.startswith('-'):
            key, _, val = line.partition(':')
            key = key.strip()
            val = val.strip().strip("'\"")
            if val:
                fm[key] = val

    return fm, content


def is_already_good(title, location, city):
    """Check if title is already in a good SEO format."""
    if not title:
        return False
    # Already has "at Venue" pattern
    if location and f"at {location}" in title:
        return True
    # Already ends with ", City"
    if city and title.endswith(f", {city}"):
        return True
    # Short and has venue name
    if location and location.lower() in title.lower() and len(title) <= 60:
        return True
    return False


def extract_dish_context(title, location):
    """Extract the dish/experience part from the title, removing the venue name if present."""
    if not title:
        return ""

    # Remove "Instagram Post — Date" prefix
    title = re.sub(r'^Instagram Post\s*[—–-]\s*\w+\s+\d{1,2},?\s*\d{4}\s*', '', title, flags=re.IGNORECASE)

    if not location:
        return title.strip()

    # Try to extract what comes before the venue mention
    # Patterns like "X at Venue" or "X from Venue"
    for prep in ['at', 'from', 'in', '@']:
        pattern = re.compile(rf'^(.*?)\s+{prep}\s+{re.escape(location)}', re.IGNORECASE)
        m = pattern.match(title)
        if m and m.group(1).strip():
            return m.group(1).strip()

    # If venue is in the title, take what's before it
    loc_lower = location.lower()
    title_lower = title.lower()
    idx = title_lower.find(loc_lower)
    if idx > 3:
        before = title[:idx].strip().rstrip(' -–—,at')
        if before:
            return before

    return ""


def build_seo_title(fm):
    """Build an SEO-optimized title from frontmatter.

    Conservative approach: only use the location field if it already
    appears in the title (confirming the Foursquare match is correct).
    Otherwise, just append city to the existing title.
    """
    title = fm.get('title', '')
    location = fm.get('location', '')
    city = fm.get('city', '')

    if not city:
        return None  # Need at least a city to improve

    if is_already_good(title, location, city):
        return None

    # Check if location name is confirmed (appears in title)
    location_confirmed = (
        location and location.lower() in title.lower()
    )

    # For generic "Instagram Post" titles, use confirmed location + city
    is_generic = re.match(r'^Instagram Post\s*[—–-]', title, re.IGNORECASE)
    if is_generic:
        if location_confirmed:
            new_title = f"{location}, {city}"
        elif location:
            # Location exists but doesn't match title — don't trust it
            return None
        else:
            return None
    else:
        # Regular title — just append city if not already there
        clean = re.sub(r'\s{2,}', ' ', title).strip()
        if city.lower() in clean.lower():
            return None  # City already in title
        new_title = f"{clean}, {city}"

    # Enforce max length
    if len(new_title) > 60:
        # Try dropping the dish context
        if location and city:
            new_title = f"{location}, {city}"
        if len(new_title) > 60:
            new_title = new_title[:57].rsplit(' ', 1)[0] + '...'

    # Don't replace with something shorter/worse than what's there
    if len(new_title) < 5:
        return None

    # Don't replace if the new title is the same
    if new_title.strip() == title.strip():
        return None

    return new_title


def process_file(filepath, dry_run=False):
    """Process a single file."""
    fm, content = parse_frontmatter(filepath)
    if fm is None:
        return None

    new_title = build_seo_title(fm)
    if not new_title:
        return None

    old_title = fm.get('title', '')

    result = {
        'file': os.path.basename(filepath),
        'old': old_title,
        'new': new_title,
    }

    if not dry_run:
        # Replace title in file
        old_patterns = [
            f"title: '{old_title}'",
            f'title: "{old_title}"',
            f'title: {old_title}',
        ]
        new_val = f"title: '{new_title}'" if "'" not in new_title else f'title: "{new_title}"'

        for pattern in old_patterns:
            if pattern in content:
                content = content.replace(pattern, new_val, 1)
                break

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return result


def main():
    parser = argparse.ArgumentParser(description='Reformat titles for SEO')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes')
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f"Scanning {len(files)} posts...")

    results = []
    for f in files:
        r = process_file(f, dry_run=args.dry_run)
        if r:
            results.append(r)

    if not results:
        print("All titles are already SEO-optimized.")
        return

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Reformatted {len(results)} titles:\n")
    for r in results[:30]:
        print(f"  {r['file']}")
        print(f"    OLD: {r['old']}")
        print(f"    NEW: {r['new']}")
        print()

    if len(results) > 30:
        print(f"  ... and {len(results) - 30} more\n")

    if args.dry_run:
        print(f"Run without --dry-run to apply {len(results)} title changes.")


if __name__ == '__main__':
    main()
