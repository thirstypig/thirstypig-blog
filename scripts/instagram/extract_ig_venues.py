#!/usr/bin/env python3
"""
Extract venue names and cities from Instagram post captions.

Parses common food blog caption patterns to identify restaurant names
and locations, then updates post frontmatter.
"""

import glob
import os
import re
import sys

import yaml

# Add parent dirs to path for shared imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from shared.city_data import CITY_MAP, HASHTAG_CITY_MAP

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'content', 'posts')

def extract_venue_from_caption(title: str, body: str) -> str | None:
    """Extract venue/restaurant name from caption text."""
    # Combine title and body for analysis
    text = title
    if body:
        # Get just the caption text (skip image/video lines)
        caption_lines = []
        for line in body.strip().split('\n'):
            line = line.strip()
            if line and not line.startswith('![') and not line.startswith('<video'):
                caption_lines.append(line)
        if caption_lines:
            text = caption_lines[0]  # First caption line is usually most informative

    if not text:
        return None

    # Skip generic titles
    if re.match(r'^Instagram Post', text):
        return None

    # Pattern 1: "X at Y" — "Brunch at Toast", "lunch at Manuela"
    m = re.search(r'(?:\bat\b|@)\s+([\w][\w\s&\'\.·\-]+?)(?:\s+in\s+|\s+on\s+|\s+for\s+|\s*[,\.\!\?\n]|$)', text, re.IGNORECASE)
    if m:
        venue = m.group(1).strip().rstrip('.')
        # Title-case it
        venue_words = venue.split()
        skip_venue = {'the', 'this', 'my', 'our', 'a', 'an', 'some', 'home', 'work',
                      'night', 'noon', 'least', 'last', 'all', 'that', 'it', 'its',
                      'first', 'one', 'two', 'three', 'around', 'about'}
        if (len(venue) > 2 and len(venue) < 60
                and venue_words[0].lower() not in skip_venue):
            venue = ' '.join(w.capitalize() if w.islower() else w for w in venue_words)
            return venue

    # Pattern 2: "X from Y" — "Tacos from Guisados"
    m = re.search(r'\bfrom\s+([\w][\w\s&\'\.·\-]+?)(?:\s+in\s+|\s+on\s+|\s*[,\.\!\?\n]|$)', text, re.IGNORECASE)
    if m:
        venue = m.group(1).strip().rstrip('.')
        skip = {'the', 'this', 'my', 'our', 'a', 'an', 'some', 'last', 'their',
                'scratch', 'home', 'here', 'there', 'today', 'yesterday'}
        venue_words = venue.split()
        if (len(venue) > 2 and len(venue) < 60
                and venue_words[0].lower() not in skip):
            venue = ' '.join(w.capitalize() if w.islower() else w for w in venue_words)
            return venue

    # Pattern 3: Title IS "Venue Name" style (capitalized, short, no common sentence starters)
    # e.g., "Haidilao 海底撈 hot pot", "In-N-Out Burger"
    skip_starts = {'The ', 'A ', 'An ', 'My ', 'Our ', 'We ', 'I ', 'Had ', 'Got ',
                   'Just ', 'Some ', 'More ', 'Another ', 'Great ', 'Best ', 'Good ',
                   'Amazing ', 'Awesome ', 'Love ', 'Check ', 'Went ', 'Back ',
                   'Happy ', 'New ', 'First ', 'Last ', 'This ', 'That ', 'What ',
                   'Found ', 'Feeling ', 'Been ', 'After ', 'Before ', 'Finally ',
                   'Today ', 'Tonight ', 'Weekend ', 'Sunday ', 'Saturday ', 'Friday ',
                   'Views ', 'Chillin', 'Brunch ', 'Lunch ', 'Dinner ', 'Breakfast ',
                   'Quick ', 'Late ', 'Early ', 'Simple ', 'Not ', 'It ', 'So ',
                   'One ', 'Two ', 'Three ', 'Roasted ', 'Fried ', 'Grilled ',
                   'Tried ', 'Instagram ', 'Pizza ', 'Tacos ', 'Burger ', 'Ramen ',
                   'Might ', 'Could ', 'Would ', 'Should ', 'Can ', 'Do ', 'Does '}

    # Pattern 4: "@handle" in text — extract handle as venue
    m = re.search(r'@([\w.]+)', text)
    if m:
        handle = m.group(1).rstrip('.')
        # Convert handle to readable name
        if len(handle) > 2 and handle.lower() not in {'thirstypig', 'instagram'}:
            # Clean up handle: thanks.pizza.us -> Thanks Pizza
            venue = handle.replace('.', ' ').replace('_', ' ')
            venue = ' '.join(w.capitalize() for w in venue.split())
            return venue

    return None


def extract_city_from_text(text: str, tags: list[str]) -> tuple[str, str] | None:
    """Extract city from caption text and hashtags."""
    if not text and not tags:
        return None

    text_lower = (text or '').lower()

    # Check caption text for "in CityName" pattern
    m = re.search(r'\bin\s+([\w\s]+?)(?:\s*[,\.\!\?\n]|$)', text_lower)
    if m:
        location_phrase = m.group(1).strip()
        for city_key, (city, region) in CITY_MAP.items():
            if city_key in location_phrase:
                return (city, region)

    # Check caption text for city names anywhere
    for city_key, (city, region) in sorted(CITY_MAP.items(), key=lambda x: -len(x[0])):
        if len(city_key) > 3 and re.search(r'\b' + re.escape(city_key) + r'\b', text_lower):
            return (city, region)
    # Short city names need more context (avoid false positives)
    for city_key in ['dtla', 'sgv', 'mpk', 'nyc', 'weho']:
        if re.search(r'\b' + re.escape(city_key) + r'\b', text_lower):
            city, region = CITY_MAP[city_key]
            return (city, region)

    # Check hashtags
    for tag in tags:
        tag_lower = tag.lower().replace('#', '')
        if tag_lower in HASHTAG_CITY_MAP:
            return HASHTAG_CITY_MAP[tag_lower]
        # Check if hashtag contains a city name
        for city_key, (city, region) in sorted(CITY_MAP.items(), key=lambda x: -len(x[0])):
            if len(city_key) > 4 and city_key.replace(' ', '') in tag_lower:
                return (city, region)

    return None


def main():
    print('=' * 60)
    print('  EXTRACT VENUES FROM INSTAGRAM CAPTIONS')
    print('=' * 60)

    md_files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f'Scanning {len(md_files)} posts...\n')

    updated = 0
    venue_added = 0
    city_added = 0

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

        if not fm or fm.get('source') != 'instagram':
            continue

        has_location = fm.get('location')
        has_city = fm.get('city')

        if has_location and has_city:
            continue

        title = fm.get('title', '')
        body = parts[2]
        tags = fm.get('tags', []) or []

        # Get full text for analysis
        caption_text = title
        body_lines = [l.strip() for l in body.strip().split('\n')
                      if l.strip() and not l.strip().startswith('![') and not l.strip().startswith('<video')]
        if body_lines:
            caption_text = '\n'.join(body_lines[:5])

        changed = False

        # Extract venue name
        if not has_location:
            venue = extract_venue_from_caption(title, body)
            if venue:
                fm['location'] = venue
                venue_added += 1
                changed = True

        # Extract city
        if not has_city:
            full_text = title + '\n' + caption_text
            city_result = extract_city_from_text(full_text, tags)
            if city_result:
                city, region = city_result
                fm['city'] = city
                fm['region'] = region
                city_added += 1
                changed = True

        if changed:
            yaml_str = yaml.dump(fm, default_flow_style=False,
                                 allow_unicode=True, sort_keys=False, width=1000)
            with open(path, 'w', encoding='utf-8') as f:
                f.write('---\n')
                f.write(yaml_str)
                f.write('---')
                f.write(parts[2])
            updated += 1

    print(f'\nResults:')
    print(f'  Posts updated: {updated}')
    print(f'  Venue names extracted: {venue_added}')
    print(f'  Cities identified: {city_added}')

    # Show remaining gaps
    total_ig = 0
    no_location = 0
    no_city = 0
    for path in md_files:
        with open(path, encoding='utf-8') as f:
            content = f.read()
        parts = content.split('---', 2)
        if len(parts) < 3:
            continue
        try:
            fm = yaml.safe_load(parts[1])
        except:
            continue
        if fm and fm.get('source') == 'instagram':
            total_ig += 1
            if not fm.get('location'):
                no_location += 1
            if not fm.get('city'):
                no_city += 1

    print(f'\n  Instagram posts: {total_ig}')
    print(f'  Still missing location: {no_location}')
    print(f'  Still missing city: {no_city}')
    print(f'\nDone!')


if __name__ == '__main__':
    main()
