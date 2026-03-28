#!/usr/bin/env python3
"""
Restaurant Info Extractor & Categorizer.

Parses post titles and content to extract:
- Restaurant name
- City
- Region
- Address
- Whether the restaurant is closed
Adds city/region to categories and sets location/city/region frontmatter.
"""

import os
import re
import glob
import yaml
from collections import Counter

CONTENT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'content', 'posts')

# City → Region mapping for LA area and beyond
CITY_TO_REGION = {
    # San Gabriel Valley
    'alhambra': 'San Gabriel Valley',
    'arcadia': 'San Gabriel Valley',
    'azusa': 'San Gabriel Valley',
    'covina': 'San Gabriel Valley',
    'diamond bar': 'San Gabriel Valley',
    'duarte': 'San Gabriel Valley',
    'el monte': 'San Gabriel Valley',
    'glendora': 'San Gabriel Valley',
    'hacienda heights': 'San Gabriel Valley',
    'industry': 'San Gabriel Valley',
    'irwindale': 'San Gabriel Valley',
    'la puente': 'San Gabriel Valley',
    'monrovia': 'San Gabriel Valley',
    'monterey park': 'San Gabriel Valley',
    'mpk': 'San Gabriel Valley',
    'pasadena': 'Pasadena',
    'rosemead': 'San Gabriel Valley',
    'rowland heights': 'San Gabriel Valley',
    'san gabriel': 'San Gabriel Valley',
    'sgv': 'San Gabriel Valley',
    'south pasadena': 'Pasadena',
    'temple city': 'San Gabriel Valley',
    'walnut': 'San Gabriel Valley',
    'west covina': 'San Gabriel Valley',
    # Westside
    'bel air': 'Westside',
    'beverly hills': 'Westside',
    'brentwood': 'Westside',
    'century city': 'Westside',
    'culver city': 'Westside',
    'malibu': 'Westside',
    'mar vista': 'Westside',
    'pacific palisades': 'Westside',
    'playa del rey': 'Westside',
    'santa monica': 'Westside',
    'venice': 'Westside',
    'west hollywood': 'Westside',
    'west la': 'Westside',
    'west los angeles': 'Westside',
    'westchester': 'Westside',
    'westwood': 'Westside',
    # Downtown LA
    'downtown la': 'Downtown LA',
    'dtla': 'Downtown LA',
    'chinatown': 'Downtown LA',
    'little tokyo': 'Downtown LA',
    'arts district': 'Downtown LA',
    # Central LA / Hollywood
    'echo park': 'Central LA',
    'east hollywood': 'Central LA',
    'hancock park': 'Central LA',
    'hollywood': 'Hollywood',
    'koreatown': 'Koreatown',
    'k-town': 'Koreatown',
    'ktown': 'Koreatown',
    'larchmont': 'Central LA',
    'los feliz': 'Central LA',
    'mid-city': 'Central LA',
    'mid-wilshire': 'Central LA',
    'silver lake': 'Central LA',
    'silverlake': 'Central LA',
    'thai town': 'Central LA',
    # South Bay
    'el segundo': 'South Bay',
    'gardena': 'South Bay',
    'hermosa beach': 'South Bay',
    'manhattan beach': 'South Bay',
    'palos verdes': 'South Bay',
    'redondo beach': 'South Bay',
    'torrance': 'South Bay',
    # Long Beach / Harbor
    'long beach': 'Long Beach',
    'san pedro': 'Harbor',
    'wilmington': 'Harbor',
    # Orange County
    'anaheim': 'Orange County',
    'costa mesa': 'Orange County',
    'fountain valley': 'Orange County',
    'fullerton': 'Orange County',
    'garden grove': 'Orange County',
    'huntington beach': 'Orange County',
    'irvine': 'Orange County',
    'laguna beach': 'Orange County',
    'newport beach': 'Orange County',
    'orange': 'Orange County',
    'tustin': 'Orange County',
    'westminster': 'Orange County',
    'oc': 'Orange County',
    # San Fernando Valley
    'burbank': 'San Fernando Valley',
    'glendale': 'San Fernando Valley',
    'north hollywood': 'San Fernando Valley',
    'sherman oaks': 'San Fernando Valley',
    'studio city': 'San Fernando Valley',
    'van nuys': 'San Fernando Valley',
    'woodland hills': 'San Fernando Valley',
    # Other California
    'san francisco': 'Bay Area',
    'sf': 'Bay Area',
    'oakland': 'Bay Area',
    'san jose': 'Bay Area',
    'san diego': 'San Diego',
    'las vegas': 'Las Vegas',
    'mammoth': 'California',
    # International
    'shanghai': 'Shanghai',
    'taipei': 'Taipei',
    'tokyo': 'Tokyo',
    'seoul': 'Seoul',
    'hong kong': 'Hong Kong',
    'beijing': 'Beijing',
    'singapore': 'Singapore',
    'bangkok': 'Bangkok',
    'paris': 'Paris',
    'london': 'London',
    'new york': 'New York',
    'nyc': 'New York',
    'hawaii': 'Hawaii',
    'honolulu': 'Hawaii',
    'maui': 'Hawaii',
    'taiwan': 'Taiwan',
}

# Common non-restaurant title patterns to skip
SKIP_TITLE_PATTERNS = [
    r'^about',
    r'^cocktail of the week',
    r'^instagram post',
    r'^the thirsty pig',
    r'^new thirsty pig',
    r'^shows.*podcasts',
    r'^sixes must dine',
    r'^la jimmy',
    r'^\w+ [A-Z]\.$',  # "Amy L.", "Bing Y." — person names
    r'^menu$',
]


def extract_restaurant_and_city(title: str) -> tuple[str | None, str | None]:
    """Extract restaurant name and city from a blog post title like 'Savoy Kitchen, SGV Los Angeles'."""
    if not title:
        return None, None

    # Skip non-restaurant titles
    for pattern in SKIP_TITLE_PATTERNS:
        if re.match(pattern, title, re.IGNORECASE):
            return None, None

    # Pattern: "Restaurant Name, City/Location"
    if ',' in title:
        parts = title.rsplit(',', 1)
        restaurant = parts[0].strip()
        city_part = parts[1].strip()

        # Clean up city
        city_part = re.sub(r'\s*\(.*?\)\s*', '', city_part)  # remove parenthetical
        city_part = re.sub(r'\s*-\s*closed\s*$', '', city_part, flags=re.IGNORECASE)

        return restaurant, city_part

    # Pattern: "Restaurant Name – City" or "Restaurant Name - City"
    for sep in [' – ', ' — ', ' - ']:
        if sep in title:
            parts = title.split(sep, 1)
            if len(parts) == 2:
                return parts[0].strip(), parts[1].strip()

    return title, None


def detect_city(title: str, city_hint: str | None, body: str, categories: list) -> str | None:
    """Detect the city from various sources."""
    # Check the city hint from title parsing
    if city_hint:
        city_lower = city_hint.lower().strip()
        # Direct match
        if city_lower in CITY_TO_REGION:
            return city_hint.title()
        # Check if any known city is IN the hint
        for known_city in CITY_TO_REGION:
            if known_city in city_lower:
                return known_city.title()
        # Use as-is if it looks like a city name
        if len(city_hint) > 2 and not city_hint.isdigit():
            return city_hint

    # Check existing categories
    for cat in categories:
        cat_lower = cat.lower()
        if cat_lower in CITY_TO_REGION:
            return cat.title() if cat.islower() else cat

    # Check body for address patterns
    address_match = re.search(r'\b(?:Los Angeles|Pasadena|Alhambra|Arcadia|San Gabriel|Monterey Park|Rosemead|Beverly Hills|Santa Monica|Hollywood|Burbank|Glendale|Long Beach|Torrance|Shanghai|Taipei|Tokyo|Seoul)\b', body, re.IGNORECASE)
    if address_match:
        return address_match.group(0).title()

    return None


def detect_region(city: str | None, categories: list) -> str | None:
    """Map a city to its region."""
    if city:
        city_lower = city.lower().strip()
        if city_lower in CITY_TO_REGION:
            return CITY_TO_REGION[city_lower]

    # Check categories for region hints
    for cat in categories:
        cat_lower = cat.lower()
        if cat_lower in CITY_TO_REGION:
            return CITY_TO_REGION[cat_lower]
        # Direct region names
        if cat in ('San Gabriel Valley', 'SGV', 'Downtown LA', 'Westside', 'South Bay',
                   'Hollywood', 'Koreatown', 'Orange County', 'Bay Area'):
            return cat

    return None


def detect_closed(title: str, slug: str, body: str) -> bool:
    """Detect if a restaurant is marked as closed."""
    title_lower = title.lower()
    slug_lower = slug.lower()
    body_lower = body.lower()[:500]  # check first part of body

    if 'closed' in slug_lower:
        return True
    if re.search(r'\bclosed\b', title_lower):
        return True
    if re.search(r'permanently\s+closed', body_lower):
        return True
    if re.search(r'has\s+closed', body_lower):
        return True
    if re.search(r'now\s+closed', body_lower):
        return True

    return False


def extract_address(body: str) -> str | None:
    """Try to extract a street address from the post body."""
    # Pattern: number + street name + city, state zip
    match = re.search(
        r'(\d{1,5}\s+(?:N\.?|S\.?|E\.?|W\.?|North|South|East|West)?\s*[A-Z][a-zA-Z\s\.]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Way|Ln|Lane|Pl|Place|Ct|Court)[\.!,]?\s*(?:[A-Z][a-zA-Z\s]+,?\s*(?:CA|California)\s*\d{5})?)',
        body
    )
    if match:
        addr = match.group(1).strip().rstrip(',').rstrip('.')
        if len(addr) > 10:
            return addr
    return None


def process_posts():
    """Process all posts to extract and update restaurant info."""
    files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f'Processing {len(files)} posts...')

    stats = {
        'location_set': 0, 'city_set': 0, 'region_set': 0,
        'closed_detected': 0, 'address_found': 0, 'categories_added': 0,
    }
    closed_list = []

    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        parts = content.split('---', 2)
        if len(parts) < 3:
            continue

        try:
            fm = yaml.safe_load(parts[1])
        except Exception:
            continue

        body = parts[2]
        title = fm.get('title', '')
        slug = os.path.basename(filepath).replace('.md', '')
        categories = fm.get('categories', []) or []
        tags = fm.get('tags', []) or []
        modified = False

        # Extract restaurant and city from title
        restaurant, city_hint = extract_restaurant_and_city(title)

        # Set location (restaurant name)
        if restaurant and not fm.get('location'):
            fm['location'] = restaurant
            stats['location_set'] += 1
            modified = True

        # Detect city
        city = detect_city(title, city_hint, body, categories)
        if city and not fm.get('city'):
            fm['city'] = city
            stats['city_set'] += 1
            modified = True

            # Add city to categories if not there
            if city not in categories:
                categories.append(city)
                stats['categories_added'] += 1

        # Detect region
        region = detect_region(city or fm.get('city'), categories)
        if region and not fm.get('region'):
            fm['region'] = region
            stats['region_set'] += 1
            modified = True

            # Add region to categories if not there
            if region not in categories:
                categories.append(region)
                stats['categories_added'] += 1

        # Detect closed
        is_closed = detect_closed(title, slug, body)
        if is_closed:
            stats['closed_detected'] += 1
            closed_list.append(title)
            if 'closed' not in [t.lower() for t in tags]:
                tags.append('closed')
                modified = True

        # Extract address
        address = extract_address(body)
        if address and not fm.get('address'):
            fm['address'] = address
            stats['address_found'] += 1
            modified = True

        # Update categories and tags
        if categories != (fm.get('categories', []) or []):
            fm['categories'] = categories
            modified = True
        if tags != (fm.get('tags', []) or []):
            fm['tags'] = tags
            modified = True

        # Write back if modified
        if modified:
            yaml_str = yaml.dump(fm, default_flow_style=False,
                                allow_unicode=True, sort_keys=False, width=1000)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write('---\n')
                f.write(yaml_str)
                f.write('---')
                f.write(body)

    print(f'\n=== RESULTS ===')
    print(f'Restaurant names set: {stats["location_set"]}')
    print(f'Cities detected: {stats["city_set"]}')
    print(f'Regions detected: {stats["region_set"]}')
    print(f'Addresses found: {stats["address_found"]}')
    print(f'Categories added: {stats["categories_added"]}')
    print(f'Closed restaurants detected: {stats["closed_detected"]}')

    if closed_list:
        print(f'\n=== CLOSED RESTAURANTS ===')
        for name in sorted(closed_list):
            print(f'  {name}')

    # Show category distribution
    all_cats = Counter()
    all_cities = Counter()
    all_regions = Counter()
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        parts = content.split('---', 2)
        if len(parts) < 3: continue
        try:
            fm = yaml.safe_load(parts[1])
        except: continue
        for c in (fm.get('categories', []) or []):
            all_cats[c] += 1
        if fm.get('city'):
            all_cities[fm['city']] += 1
        if fm.get('region'):
            all_regions[fm['region']] += 1

    print(f'\n=== TOP CITIES ===')
    for city, count in all_cities.most_common(20):
        print(f'  {city}: {count}')

    print(f'\n=== TOP REGIONS ===')
    for region, count in all_regions.most_common(15):
        print(f'  {region}: {count}')


if __name__ == '__main__':
    process_posts()
