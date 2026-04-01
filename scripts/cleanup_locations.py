#!/usr/bin/env python3
"""
Clean up messy location and city fields in post frontmatter.

Many Instagram posts had full captions dumped into the location field,
or venue names placed in the city field. This script identifies and fixes
those issues by re-extracting venue names and cities from the title/body.

Usage:
  python3 scripts/cleanup_locations.py [--dry-run]
"""

import argparse
import glob
import os
import re
import sys

import yaml

# Add parent dir to path for shared imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shared.city_data import CITY_MAP, HASHTAG_CITY_MAP, REAL_CITIES

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')

def is_location_messy(loc: str) -> bool:
    """Check if a location field looks like a caption instead of a venue name."""
    if not loc:
        return False
    if len(loc) > 50:
        return True
    if '...' in loc:
        return True
    if '. ' in loc and not re.search(r"[A-Z]\.\s[A-Z]", loc):  # Allow "Mr. B" style
        return True
    if '!' in loc:
        return True
    if '#' in loc:
        return True
    # Starts with common caption starters (not venue names)
    caption_starters = [
        'Had ', 'Just ', 'Check ', 'Finally ', 'This ', 'Enjoying ',
        'Weekend ', 'Made it', 'Saw ', 'Views ', 'On this ', 'A ',
        'An afternoon', 'Back ', 'Do you ', 'Have I ', 'I really',
        'Lights and', 'Part 2', 'Stopping ', 'After ', 'Classic ',
        'My favorite', 'We got', 'Our third', 'Memories of',
        'Chillin', 'Late night', 'Cold Dish', 'Sichuan ', 'Korean ',
        'Noodles and', 'Tandoori ', 'Grant Wood', 'Chicken kebob',
        'Oysters and', 'Doubleheader', 'Combo Platter', 'Kanpachi',
        'Barbecue chicken', 'Rotisserie ', 'Brown sugar', 'Porchetta',
        'Santa Anita', 'The most modern', 'Smoked moist', 'Pulled pork',
        'Seaside ', 'The Chronicles', 'The next stop', 'The final',
        'Lunch in ', 'Curry lunch', 'Stone pot', 'Woodinville',
        'Checking out', 'Guerrilla Tacos',
    ]
    for starter in caption_starters:
        if loc.startswith(starter):
            return True
    return False


def is_city_messy(city: str) -> bool:
    """Check if a city field contains something other than a city name."""
    if not city:
        return False
    if city in REAL_CITIES:
        return False
    if '...' in city:
        return True
    if len(city) > 30:
        return True
    # Check if it's in our city map
    if city.lower() in CITY_MAP:
        return False
    return True


def extract_venue_from_title(title: str) -> str | None:
    """Extract venue name from title using 'at X' and 'from X' patterns."""
    if not title:
        return None

    # Pattern: "X at VenueName in City" or "X at VenueName"
    m = re.search(
        r'(?:\bat\b|@)\s+([\w][\w\s&\'\.·\-\u2018\u2019]+?)(?:\s+in\s+|\s+on\s+|\s+for\s+|\s*[,\.\!\?\n]|$)',
        title, re.IGNORECASE
    )
    if m:
        venue = m.group(1).strip().rstrip('.')
        venue_words = venue.split()
        skip = {'the', 'this', 'my', 'our', 'a', 'an', 'some', 'home', 'work',
                'night', 'noon', 'least', 'last', 'all', 'that', 'it', 'its',
                'first', 'one', 'two', 'three', 'around', 'about', 'pike'}
        if 2 < len(venue) < 50 and venue_words[0].lower() not in skip:
            return venue

    # Pattern: "X from VenueName"
    m = re.search(
        r'\bfrom\s+([\w][\w\s&\'\.·\-\u2018\u2019]+?)(?:\s+in\s+|\s+on\s+|\s*[,\.\!\?\n]|$)',
        title, re.IGNORECASE
    )
    if m:
        venue = m.group(1).strip().rstrip('.')
        skip = {'the', 'this', 'my', 'our', 'a', 'an', 'some', 'last', 'their',
                'scratch', 'home', 'here', 'there', 'today', 'yesterday',
                'southern', 'coast'}
        venue_words = venue.split()
        if 2 < len(venue) < 50 and venue_words[0].lower() not in skip:
            return venue

    return None


def extract_city_from_text(text: str, tags: list[str] | None = None) -> tuple[str, str] | None:
    """Extract city from text and hashtags."""
    text_lower = (text or '').lower()

    # Check "in CityName" pattern first (most reliable)
    m = re.search(r'\bin\s+([\w\s\-\']+?)(?:\s*[,\.\!\?\n]|$)', text_lower)
    if m:
        phrase = m.group(1).strip()
        for city_key, (city, region) in sorted(CITY_MAP.items(), key=lambda x: -len(x[0])):
            if city_key in phrase:
                return (city, region)

    # Check for city names anywhere in text
    for city_key, (city, region) in sorted(CITY_MAP.items(), key=lambda x: -len(x[0])):
        if len(city_key) > 3 and re.search(r'\b' + re.escape(city_key) + r'\b', text_lower):
            return (city, region)

    # Short city codes
    for city_key in ['dtla', 'sgv', 'mpk', 'nyc', 'weho', 'hkg']:
        if re.search(r'\b' + re.escape(city_key) + r'\b', text_lower):
            if city_key in CITY_MAP:
                return CITY_MAP[city_key]

    # Check hashtags
    if tags:
        for tag in tags:
            tag_lower = tag.lower().replace('#', '')
            if tag_lower in HASHTAG_CITY_MAP:
                return HASHTAG_CITY_MAP[tag_lower]
            for city_key, (city, region) in sorted(CITY_MAP.items(), key=lambda x: -len(x[0])):
                if len(city_key) > 4 and city_key.replace(' ', '') in tag_lower:
                    return (city, region)

    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Show changes without writing')
    args = parser.parse_args()

    print('=' * 60)
    print('  CLEANUP MESSY LOCATION/CITY FIELDS')
    print('=' * 60)

    md_files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f'Scanning {len(md_files)} posts...\n')

    fixed_location = 0
    fixed_city = 0
    cleared_location = 0
    cleared_city = 0
    total_messy = 0

    for path in md_files:
        with open(path, encoding='utf-8') as f:
            content = f.read()

        parts = content.split('---', 2)
        if len(parts) < 3:
            continue

        try:
            fm = yaml.safe_load(parts[1])
        except Exception:
            continue

        if not fm:
            continue

        # Skip posts that already have coordinates (already geocoded)
        if fm.get('coordinates'):
            continue

        loc = str(fm.get('location', ''))
        city = str(fm.get('city', ''))
        title = str(fm.get('title', ''))
        tags = fm.get('tags', []) or []
        body = parts[2]

        loc_messy = is_location_messy(loc)
        city_messy = is_city_messy(city)

        if not loc_messy and not city_messy:
            continue

        total_messy += 1
        changed = False
        fname = os.path.basename(path)

        # Build full text for city extraction
        full_text = title
        body_lines = [l.strip() for l in body.strip().split('\n')
                      if l.strip() and not l.strip().startswith('![') and not l.strip().startswith('<video')]
        if body_lines:
            full_text += '\n' + '\n'.join(body_lines[:5])

        # Fix messy location field
        if loc_messy:
            new_venue = extract_venue_from_title(title)
            if new_venue:
                if args.dry_run:
                    print(f'  FIX LOC  {fname}')
                    print(f'           old: {loc[:70]}')
                    print(f'           new: {new_venue}')
                fm['location'] = new_venue
                fixed_location += 1
                changed = True
            else:
                if args.dry_run:
                    print(f'  CLR LOC  {fname}')
                    print(f'           was: {loc[:70]}')
                del fm['location']
                cleared_location += 1
                changed = True

        # Fix messy city field
        if city_messy:
            city_result = extract_city_from_text(full_text, tags)
            if city_result:
                new_city, new_region = city_result
                if args.dry_run:
                    print(f'  FIX CITY {fname}')
                    print(f'           old: {city}')
                    print(f'           new: {new_city} ({new_region})')
                fm['city'] = new_city
                fm['region'] = new_region
                fixed_city += 1
                changed = True
            else:
                # Check if the old city value is actually a venue name that was misplaced
                if args.dry_run:
                    print(f'  CLR CITY {fname}')
                    print(f'           was: {city}')
                del fm['city']
                if 'region' in fm and fm.get('region') and is_city_messy(str(fm.get('region', ''))):
                    del fm['region']
                cleared_city += 1
                changed = True

        if changed and not args.dry_run:
            yaml_str = yaml.dump(fm, default_flow_style=False,
                                 allow_unicode=True, sort_keys=False, width=1000)
            with open(path, 'w', encoding='utf-8') as f:
                f.write('---\n')
                f.write(yaml_str)
                f.write('---')
                f.write(parts[2])

        if args.dry_run and changed:
            print()

    print(f'\nResults:')
    print(f'  Total messy posts found: {total_messy}')
    print(f'  Location fixed (re-extracted): {fixed_location}')
    print(f'  Location cleared (no venue found): {cleared_location}')
    print(f'  City fixed (re-extracted): {fixed_city}')
    print(f'  City cleared (not a real city): {cleared_city}')

    if args.dry_run:
        print(f'\n  (DRY RUN — no files changed)')
    else:
        print(f'\n  Files updated: {fixed_location + cleared_location + fixed_city + cleared_city}')


if __name__ == '__main__':
    main()
