#!/usr/bin/env python3
"""
Extract venue names, addresses, and phone numbers from blog post content.

Parses the common patterns used in Thirsty Pig posts:
- #### Restaurant Name Address City (Phone)
- #### Restaurant Name\nAddress\nPhone
- Yelp links
- Inline address mentions

Updates frontmatter with location, address, and city fields where missing.
"""

import glob
import os
import re

import yaml

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')

# US phone pattern
PHONE_PATTERN = r'\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}'
# International phone pattern
INTL_PHONE_PATTERN = r'\+\d{1,3}[\s.-]?\d{1,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}'

# US address pattern: number + street name
US_ADDRESS_PATTERN = r'(\d{1,5}\s+[\w\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Pl|Place|Ln|Lane|Ct|Court|Pkwy|Parkway|Hwy|Highway|Sq|Square)\.?)'

# City/state patterns
CITY_STATE_PATTERN = r'(?:,?\s*)([\w\s]+),?\s*(?:CA|California|NY|New York|TX|Texas|NV|Nevada|HI|Hawaii|OR|Oregon|WA|Washington|IL|Illinois)\s*(?:\d{5})?'

# Known city mappings for normalization
CITY_NORMALIZE = {
    'la': 'Los Angeles', 'l.a.': 'Los Angeles', 'l.a': 'Los Angeles',
    'dtla': 'Downtown LA', 'samo': 'Santa Monica', 'k-town': 'Koreatown',
    'ktown': 'Koreatown', 'k town': 'Koreatown', 'weho': 'West Hollywood',
    'mpk': 'Monterey Park', 'sgv': 'San Gabriel Valley',
    'bh': 'Beverly Hills', 'nyc': 'New York',
}

CITY_REGIONS = {
    'Los Angeles': 'Los Angeles', 'Downtown LA': 'Los Angeles',
    'Koreatown': 'Los Angeles', 'Hollywood': 'Los Angeles',
    'West Hollywood': 'Los Angeles', 'Silver Lake': 'Los Angeles',
    'Echo Park': 'Los Angeles', 'Los Feliz': 'Los Angeles',
    'Eagle Rock': 'Los Angeles', 'Highland Park': 'Los Angeles',
    'Venice': 'Los Angeles', 'Santa Monica': 'Los Angeles',
    'Culver City': 'Los Angeles', 'Beverly Hills': 'Los Angeles',
    'Brentwood': 'Los Angeles', 'Westwood': 'Los Angeles',
    'Chinatown': 'Los Angeles', 'Little Tokyo': 'Los Angeles',
    'Pasadena': 'San Gabriel Valley', 'Alhambra': 'San Gabriel Valley',
    'Arcadia': 'San Gabriel Valley', 'Monterey Park': 'San Gabriel Valley',
    'San Gabriel': 'San Gabriel Valley', 'Rosemead': 'San Gabriel Valley',
    'Temple City': 'San Gabriel Valley', 'San Marino': 'San Gabriel Valley',
    'Monrovia': 'San Gabriel Valley', 'Duarte': 'San Gabriel Valley',
    'Sierra Madre': 'San Gabriel Valley', 'La Canada': 'San Gabriel Valley',
    'Rowland Heights': 'San Gabriel Valley', 'Diamond Bar': 'San Gabriel Valley',
    'Torrance': 'South Bay', 'Gardena': 'South Bay',
    'Manhattan Beach': 'South Bay', 'El Segundo': 'South Bay',
    'Redondo Beach': 'South Bay', 'Hermosa Beach': 'South Bay',
    'Burbank': 'San Fernando Valley', 'Glendale': 'San Fernando Valley',
    'Long Beach': 'Long Beach',
    'Irvine': 'Orange County', 'Laguna Beach': 'Orange County',
    'Costa Mesa': 'Orange County', 'Lake Forest': 'Orange County',
    'Garden Grove': 'Orange County',
    'San Francisco': 'San Francisco', 'Palo Alto': 'Bay Area',
    'San Jose': 'Bay Area', 'Oakland': 'Bay Area',
    'San Diego': 'San Diego', 'Las Vegas': 'Las Vegas',
    'New York': 'New York', 'Brooklyn': 'New York',
    'Honolulu': 'Hawaii', 'Maui': 'Hawaii', 'Kahului': 'Hawaii',
    'Shanghai': 'Shanghai', 'Taipei': 'Taipei', 'Tokyo': 'Tokyo',
    'Seoul': 'Seoul', 'Hong Kong': 'Hong Kong', 'Bangkok': 'Bangkok',
    'Singapore': 'Singapore', 'Ho Chi Minh City': 'Vietnam',
    'Shenzhen': 'Shenzhen', 'Dalian': 'Dalian', 'Suzhou': 'Suzhou',
    'Taichung': 'Taiwan', 'Changhua': 'Taiwan', 'Lukang': 'Taiwan',
    'Ensenada': 'Mexico', 'Malibu': 'Los Angeles',
}


def extract_venue_block(body: str) -> dict:
    """Extract venue info from #### heading blocks at the bottom of posts."""
    result = {}

    # Look for #### or ##### headings near the bottom of the post
    # These typically contain restaurant name + address + phone
    heading_matches = list(re.finditer(
        r'^#{3,6}\s+(.+?)$',
        body, re.MULTILINE
    ))

    if not heading_matches:
        return result

    # Take the last heading block (venue info is typically at the end)
    last_heading = heading_matches[-1]
    heading_text = last_heading.group(1).strip()

    # Get any text after the heading (may contain more address info)
    after_heading = body[last_heading.end():].strip()
    after_lines = after_heading.split('\n')[:5]  # Look at next 5 lines max

    # Combine heading + following lines for parsing
    full_block = heading_text + '\n' + '\n'.join(after_lines)

    # Skip headings that are clearly not venue info
    skip_words = ['Rating', 'Pig Rating', 'Related', 'More', 'Update', 'Edit',
                  'Note', 'Photo', 'Source', 'Credit', 'Disclaimer', 'About']
    if any(heading_text.startswith(w) for w in skip_words):
        return result

    # Extract phone number
    phone_match = re.search(INTL_PHONE_PATTERN, full_block) or re.search(PHONE_PATTERN, full_block)

    # Extract US address
    address_match = re.search(US_ADDRESS_PATTERN, full_block)

    # The venue name is typically the first part before the address or phone
    venue_name = heading_text
    # Remove markdown links
    venue_name = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', venue_name)
    # Remove phone number from venue name
    if phone_match:
        venue_name = venue_name[:venue_name.find(phone_match.group(0))].strip() if phone_match.group(0) in venue_name else venue_name
    # Remove address from venue name
    if address_match and address_match.group(0) in venue_name:
        venue_name = venue_name[:venue_name.find(address_match.group(0))].strip()
    # Remove URL
    venue_name = re.sub(r'https?://\S+', '', venue_name).strip()
    venue_name = re.sub(r'www\.\S+', '', venue_name).strip()
    # Clean trailing punctuation
    venue_name = venue_name.rstrip('.,;:-– ')

    if venue_name and len(venue_name) > 1:
        result['location'] = venue_name

    if address_match:
        addr = address_match.group(1).strip().rstrip('.')
        result['address'] = addr

    return result


def extract_city_from_filename(filename: str) -> str | None:
    """Try to extract city name from the post filename."""
    basename = os.path.splitext(os.path.basename(filename))[0]
    # Remove date prefix
    basename = re.sub(r'^\d{4}-\d{2}-\d{2}-', '', basename)

    # Check for known city names in filename
    for city, region in CITY_REGIONS.items():
        city_slug = city.lower().replace(' ', '-')
        if city_slug in basename.lower():
            return city

    # Check normalized city names
    for short, full in CITY_NORMALIZE.items():
        short_slug = short.lower().replace(' ', '-').replace('.', '')
        if f'-{short_slug}' in basename.lower() or basename.lower().endswith(short_slug):
            return full

    return None


def main():
    print('=' * 60)
    print('  EXTRACT VENUE INFO FROM BLOG POSTS')
    print('=' * 60)

    md_files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f'Scanning {len(md_files)} posts...\n')

    updated = 0
    venue_added = 0
    address_added = 0
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

        if not fm:
            continue

        # Skip Instagram posts (handled by separate script)
        if fm.get('source') == 'instagram':
            continue

        has_location = fm.get('location')
        has_address = fm.get('address')
        has_city = fm.get('city')

        # If already fully populated, skip
        if has_location and has_address and has_city:
            continue

        changed = False
        body = parts[2]

        # Extract from heading blocks
        venue_info = extract_venue_block(body)

        if not has_location and venue_info.get('location'):
            fm['location'] = venue_info['location']
            venue_added += 1
            changed = True

        if not has_address and venue_info.get('address'):
            fm['address'] = venue_info['address']
            address_added += 1
            changed = True

        # Try to get city from filename if not already set
        if not has_city:
            city = extract_city_from_filename(path)
            if city:
                fm['city'] = city
                if city in CITY_REGIONS:
                    fm['region'] = CITY_REGIONS[city]
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
    print(f'  Addresses extracted: {address_added}')
    print(f'  Cities identified: {city_added}')
    print(f'\nDone!')


if __name__ == '__main__':
    main()
