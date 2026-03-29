#!/usr/bin/env python3
"""
Look up restaurant addresses using Foursquare Places API (free tier: 1,000/day).

Reads posts with venue name + city but no address/coordinates,
queries Foursquare Places API, and writes results back to frontmatter.

Usage:
  1. Sign up at https://foursquare.com/developers/signup
  2. Create a project and get your API key
  3. Run:
     export FOURSQUARE_API_KEY=your_key_here
     python3 scripts/lookup_addresses.py [--dry-run] [--limit N]
"""

import argparse
import glob
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

import yaml

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')

# Known real cities for filtering
REAL_CITIES = {
    'Los Angeles', 'Downtown LA', 'Koreatown', 'Hollywood', 'West Hollywood',
    'Silver Lake', 'Echo Park', 'Venice', 'Santa Monica', 'Culver City',
    'Beverly Hills', 'Brentwood', 'Westwood', 'Chinatown', 'Little Tokyo',
    'Malibu', 'East LA', 'Arts District', 'Highland Park', 'Eagle Rock',
    'Los Feliz', 'Pasadena', 'Alhambra', 'Arcadia', 'Monterey Park',
    'San Gabriel', 'Rosemead', 'Rowland Heights', 'Temple City', 'San Marino',
    'Monrovia', 'Sierra Madre', 'La Canada', 'Diamond Bar', 'Hacienda Heights',
    'Torrance', 'Gardena', 'Manhattan Beach', 'El Segundo', 'Redondo Beach',
    'Burbank', 'Glendale', 'Long Beach', 'Irvine', 'Costa Mesa', 'Laguna Beach',
    'San Francisco', 'Oakland', 'San Jose', 'San Diego', 'Las Vegas',
    'New York', 'Brooklyn', 'Honolulu', 'Maui', 'Seattle', 'Portland', 'Chicago',
    'Shanghai', 'Taipei', 'Tokyo', 'Osaka', 'Seoul', 'Hong Kong', 'Bangkok',
    'Singapore', 'Medellin', 'La Puente', 'El Monte', 'West Covina',
    'Lake Forest', 'Garden Grove', 'Ensenada', 'Victoria',
}


def is_good_venue_name(name: str) -> bool:
    """Check if a location name looks like a real venue."""
    if not name or len(name) > 50 or len(name) < 3:
        return False
    skip_words = ['sixes', 'my top', 'must dine', 'attempt', 'efficient',
                  'underrated', 'style', 'macaroni', 'ass kicking',
                  'tasty dessert', 'secret', 'hole in', 'this is', 'farmers',
                  'best ', 'favorite', 'restaurant week', 'food festival']
    if any(w in name.lower() for w in skip_words):
        return False
    if re.match(r'^[A-Z][a-z]+ [A-Z]\.$', name):
        return False
    return True


def clean_venue_name(name: str) -> str:
    """Clean venue name for search query."""
    # Remove trailing dots, ellipsis, descriptions
    name = re.sub(r'\s*\.{2,}\s*.*$', '', name)
    name = re.sub(r'\s*[–—]\s*.*$', '', name)
    name = name.strip(' .,;:!?')
    return name


def search_foursquare(query: str, near: str, api_key: str) -> dict | None:
    """Search Foursquare Places API for a venue.

    Free tier: 1,000 calls/day.
    Docs: https://docs.foursquare.com/developer/reference/place-search
    """
    import urllib.parse
    params = urllib.parse.urlencode({
        'query': query,
        'near': near,
        'limit': 1,
    })
    url = f'https://api.foursquare.com/v3/places/search?{params}'
    headers = {
        'Accept': 'application/json',
        'Authorization': api_key,
    }

    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            results = data.get('results', [])
            if results:
                p = results[0]
                loc = p.get('location', {})
                geocodes = p.get('geocodes', {}).get('main', {})
                return {
                    'name': p.get('name', ''),
                    'address': loc.get('formatted_address', '')
                              or f"{loc.get('address', '')} {loc.get('locality', '')} {loc.get('region', '')} {loc.get('postcode', '')}".strip(),
                    'lat': geocodes.get('latitude'),
                    'lng': geocodes.get('longitude'),
                }
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f'    Rate limited! Wait and retry.')
        else:
            print(f'    API error {e.code}: {e.reason}')
    except (urllib.error.URLError, json.JSONDecodeError, KeyError) as e:
        print(f'    API error: {e}')
    return None


def main():
    parser = argparse.ArgumentParser(description='Look up restaurant addresses')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be updated')
    parser.add_argument('--limit', type=int, default=50, help='Max venues to look up')
    args = parser.parse_args()

    api_key = os.environ.get('FOURSQUARE_API_KEY', '')
    if not api_key and not args.dry_run:
        print('ERROR: Set FOURSQUARE_API_KEY environment variable')
        print('  1. Sign up at: https://foursquare.com/developers/signup')
        print('  2. Create a project → get your API key')
        print('  3. export FOURSQUARE_API_KEY=fsq3...')
        print()
        print('  Free tier: 1,000 calls/day (enough for all 671 venues)')
        print('  Or run with --dry-run to see what would be looked up')
        sys.exit(1)

    print('=' * 60)
    print('  RESTAURANT ADDRESS LOOKUP')
    print('=' * 60)

    # Find candidates
    candidates = []
    md_files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))

    for path in md_files:
        with open(path) as f:
            content = f.read()
        parts = content.split('---', 2)
        if len(parts) < 3:
            continue
        try:
            fm = yaml.safe_load(parts[1])
        except:
            continue
        if not fm:
            continue

        loc = fm.get('location', '')
        city = fm.get('city', '')
        addr = fm.get('address', '')
        coords = fm.get('coordinates')

        if not loc or not city or addr or coords:
            continue
        if city not in REAL_CITIES:
            continue
        if not is_good_venue_name(loc):
            continue

        candidates.append((path, fm, parts, loc, city))

    print(f'Candidates: {len(candidates)}')
    print(f'Processing: {min(args.limit, len(candidates))}')
    print()

    updated = 0
    for path, fm, parts, loc, city in candidates[:args.limit]:
        venue = clean_venue_name(loc)
        print(f'  [{venue}] in {city}...', end=' ', flush=True)

        if args.dry_run:
            print(f'(dry run) would search: "{venue}" near "{city}"')
            continue

        result = search_foursquare(venue, city, api_key)
        if result and result.get('lat') and result.get('address'):
            # Update venue name to the official name from Google
            if result['name'] and len(result['name']) > 2:
                fm['location'] = result['name']
            fm['address'] = result['address']
            fm['coordinates'] = {
                'lat': round(result['lat'], 6),
                'lng': round(result['lng'], 6),
            }

            yaml_str = yaml.dump(fm, default_flow_style=False,
                                 allow_unicode=True, sort_keys=False, width=1000)
            with open(path, 'w') as f:
                f.write('---\n')
                f.write(yaml_str)
                f.write('---')
                f.write(parts[2])

            print(f'✓ {result["name"]} — {result["address"][:50]}')
            updated += 1
        else:
            print('✗ not found')

        time.sleep(0.2)  # Rate limit

    print(f'\nUpdated: {updated} posts')
    print('Done!')


if __name__ == '__main__':
    main()
