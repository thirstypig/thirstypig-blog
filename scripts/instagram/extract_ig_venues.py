#!/usr/bin/env python3
"""
Extract venue names and cities from Instagram post captions.

Parses common food blog caption patterns to identify restaurant names
and locations, then updates post frontmatter.
"""

import glob
import os
import re

import yaml

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'content', 'posts')

# City keywords to look for in captions and hashtags
CITY_MAP = {
    # LA neighborhoods
    'dtla': ('Downtown LA', 'Los Angeles'),
    'downtown la': ('Downtown LA', 'Los Angeles'),
    'downtown los angeles': ('Downtown LA', 'Los Angeles'),
    'koreatown': ('Koreatown', 'Los Angeles'),
    'ktown': ('Koreatown', 'Los Angeles'),
    'k-town': ('Koreatown', 'Los Angeles'),
    'hollywood': ('Hollywood', 'Los Angeles'),
    'west hollywood': ('West Hollywood', 'Los Angeles'),
    'weho': ('West Hollywood', 'Los Angeles'),
    'silver lake': ('Silver Lake', 'Los Angeles'),
    'echo park': ('Echo Park', 'Los Angeles'),
    'los feliz': ('Los Feliz', 'Los Angeles'),
    'eagle rock': ('Eagle Rock', 'Los Angeles'),
    'highland park': ('Highland Park', 'Los Angeles'),
    'venice': ('Venice', 'Los Angeles'),
    'santa monica': ('Santa Monica', 'Los Angeles'),
    'culver city': ('Culver City', 'Los Angeles'),
    'beverly hills': ('Beverly Hills', 'Los Angeles'),
    'brentwood': ('Brentwood', 'Los Angeles'),
    'westwood': ('Westwood', 'Los Angeles'),
    'sawtelle': ('Sawtelle', 'Los Angeles'),
    'arts district': ('Arts District', 'Los Angeles'),
    'chinatown': ('Chinatown', 'Los Angeles'),
    'little tokyo': ('Little Tokyo', 'Los Angeles'),
    'malibu': ('Malibu', 'Los Angeles'),
    'los angeles': ('Los Angeles', 'Los Angeles'),
    'east la': ('East LA', 'Los Angeles'),
    'east los angeles': ('East LA', 'Los Angeles'),
    'la puente': ('La Puente', 'San Gabriel Valley'),
    # SGV
    'pasadena': ('Pasadena', 'San Gabriel Valley'),
    'alhambra': ('Alhambra', 'San Gabriel Valley'),
    'arcadia': ('Arcadia', 'San Gabriel Valley'),
    'monterey park': ('Monterey Park', 'San Gabriel Valley'),
    'san gabriel': ('San Gabriel', 'San Gabriel Valley'),
    'rosemead': ('Rosemead', 'San Gabriel Valley'),
    'rowland heights': ('Rowland Heights', 'San Gabriel Valley'),
    'temple city': ('Temple City', 'San Gabriel Valley'),
    'monrovia': ('Monrovia', 'San Gabriel Valley'),
    'duarte': ('Duarte', 'San Gabriel Valley'),
    'sierra madre': ('Sierra Madre', 'San Gabriel Valley'),
    'san marino': ('San Marino', 'San Gabriel Valley'),
    'la canada': ('La Canada', 'San Gabriel Valley'),
    'diamond bar': ('Diamond Bar', 'San Gabriel Valley'),
    'hacienda heights': ('Hacienda Heights', 'San Gabriel Valley'),
    'sgv': ('San Gabriel Valley', 'San Gabriel Valley'),
    'san gabriel valley': ('San Gabriel Valley', 'San Gabriel Valley'),
    'mpk': ('Monterey Park', 'San Gabriel Valley'),
    'el monte': ('El Monte', 'San Gabriel Valley'),
    'west covina': ('West Covina', 'San Gabriel Valley'),
    'covina': ('Covina', 'San Gabriel Valley'),
    'azusa': ('Azusa', 'San Gabriel Valley'),
    'glendora': ('Glendora', 'San Gabriel Valley'),
    # South Bay
    'torrance': ('Torrance', 'South Bay'),
    'gardena': ('Gardena', 'South Bay'),
    'manhattan beach': ('Manhattan Beach', 'South Bay'),
    'redondo beach': ('Redondo Beach', 'South Bay'),
    'hermosa beach': ('Hermosa Beach', 'South Bay'),
    'el segundo': ('El Segundo', 'South Bay'),
    # SFV
    'burbank': ('Burbank', 'San Fernando Valley'),
    'glendale': ('Glendale', 'San Fernando Valley'),
    # Other SoCal
    'long beach': ('Long Beach', 'Long Beach'),
    'irvine': ('Irvine', 'Orange County'),
    'costa mesa': ('Costa Mesa', 'Orange County'),
    'anaheim': ('Anaheim', 'Orange County'),
    'fullerton': ('Fullerton', 'Orange County'),
    'laguna beach': ('Laguna Beach', 'Orange County'),
    'orange county': ('Orange County', 'Orange County'),
    'ensenada': ('Ensenada', 'Mexico'),
    # California
    'san francisco': ('San Francisco', 'San Francisco'),
    'oakland': ('Oakland', 'Bay Area'),
    'san jose': ('San Jose', 'Bay Area'),
    'san diego': ('San Diego', 'San Diego'),
    'napa': ('Napa', 'Napa Valley'),
    # US
    'las vegas': ('Las Vegas', 'Las Vegas'),
    'vegas': ('Las Vegas', 'Las Vegas'),
    'new york': ('New York', 'New York'),
    'nyc': ('New York', 'New York'),
    'brooklyn': ('Brooklyn', 'New York'),
    'manhattan': ('Manhattan', 'New York'),
    'honolulu': ('Honolulu', 'Hawaii'),
    'maui': ('Maui', 'Hawaii'),
    'seattle': ('Seattle', 'Seattle'),
    'portland': ('Portland', 'Portland'),
    'chicago': ('Chicago', 'Chicago'),
    'austin': ('Austin', 'Texas'),
    'houston': ('Houston', 'Texas'),
    # International
    'shanghai': ('Shanghai', 'Shanghai'),
    'taipei': ('Taipei', 'Taipei'),
    'tokyo': ('Tokyo', 'Tokyo'),
    'osaka': ('Osaka', 'Osaka'),
    'kyoto': ('Kyoto', 'Kyoto'),
    'seoul': ('Seoul', 'Seoul'),
    'hong kong': ('Hong Kong', 'Hong Kong'),
    'bangkok': ('Bangkok', 'Bangkok'),
    'singapore': ('Singapore', 'Singapore'),
    'beijing': ('Beijing', 'Beijing'),
    'chengdu': ('Chengdu', 'Chengdu'),
    'medellin': ('Medellin', 'Colombia'),
    'medellín': ('Medellin', 'Colombia'),
    'bogota': ('Bogota', 'Colombia'),
    'bogotá': ('Bogota', 'Colombia'),
    'london': ('London', 'London'),
    'paris': ('Paris', 'Paris'),
    'victoria': ('Victoria', 'British Columbia'),
}

# Hashtag-to-city mapping (hashtags that imply a city)
HASHTAG_CITY_MAP = {
    'dtla': ('Downtown LA', 'Los Angeles'),
    'dtlafood': ('Downtown LA', 'Los Angeles'),
    'dtlaeats': ('Downtown LA', 'Los Angeles'),
    'lafood': ('Los Angeles', 'Los Angeles'),
    'lafoodie': ('Los Angeles', 'Los Angeles'),
    'laeats': ('Los Angeles', 'Los Angeles'),
    'losangeles': ('Los Angeles', 'Los Angeles'),
    'losangelesfood': ('Los Angeles', 'Los Angeles'),
    'koreatown': ('Koreatown', 'Los Angeles'),
    'koreatownla': ('Koreatown', 'Los Angeles'),
    'ktown': ('Koreatown', 'Los Angeles'),
    'pasadena': ('Pasadena', 'San Gabriel Valley'),
    'pasadenafood': ('Pasadena', 'San Gabriel Valley'),
    'sgv': ('San Gabriel Valley', 'San Gabriel Valley'),
    'sgvfood': ('San Gabriel Valley', 'San Gabriel Valley'),
    'sangabrielvalley': ('San Gabriel Valley', 'San Gabriel Valley'),
    'santamonica': ('Santa Monica', 'Los Angeles'),
    'beverlyhills': ('Beverly Hills', 'Los Angeles'),
    'silverlake': ('Silver Lake', 'Los Angeles'),
    'echopark': ('Echo Park', 'Los Angeles'),
    'nyc': ('New York', 'New York'),
    'nycfood': ('New York', 'New York'),
    'newyork': ('New York', 'New York'),
    'brooklyn': ('Brooklyn', 'New York'),
    'shanghai': ('Shanghai', 'Shanghai'),
    'taipei': ('Taipei', 'Taipei'),
    'tokyo': ('Tokyo', 'Tokyo'),
    'seoul': ('Seoul', 'Seoul'),
    'hongkong': ('Hong Kong', 'Hong Kong'),
    'bangkok': ('Bangkok', 'Bangkok'),
    'singapore': ('Singapore', 'Singapore'),
    'lasvegas': ('Las Vegas', 'Las Vegas'),
    'sanfrancisco': ('San Francisco', 'San Francisco'),
    'sandiego': ('San Diego', 'San Diego'),
    'seattle': ('Seattle', 'Seattle'),
    'chicago': ('Chicago', 'Chicago'),
    'hawaii': ('Hawaii', 'Hawaii'),
    'honolulu': ('Honolulu', 'Hawaii'),
    'maui': ('Maui', 'Hawaii'),
    'medellin': ('Medellin', 'Colombia'),
    'colombiafood': ('Colombia', 'Colombia'),
    'socal': ('Los Angeles', 'Los Angeles'),
    'southerncalifornia': ('Los Angeles', 'Los Angeles'),
}


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
