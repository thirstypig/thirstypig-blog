#!/usr/bin/env python3
"""
Look up restaurant addresses using Foursquare Places API.

Reads posts with venue name + city but no address/coordinates,
queries Foursquare, and writes results back to frontmatter.

Usage:
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
import urllib.parse

import yaml

# Add parent dir to path for shared imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shared.city_data import REAL_CITIES, CITY_SEARCH_NAMES

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')


def is_good_venue_name(name: str) -> bool:
    if not name or len(name) > 50 or len(name) < 3:
        return False
    skip_words = ['sixes', 'my top', 'must dine', 'attempt', 'efficient',
                  'underrated', 'style', 'macaroni', 'ass kicking',
                  'tasty dessert', 'secret', 'hole in', 'this is', 'farmers',
                  'best ', 'favorite', 'restaurant week', 'food festival',
                  'top 10', 'top 50', 'festival', 'barbeque festival']
    if any(w in name.lower() for w in skip_words):
        return False
    if re.match(r'^[A-Z][a-z]+ [A-Z]\.$', name):
        return False
    return True


def clean_venue_name(name: str) -> str:
    name = re.sub(r'\s*\.{2,}\s*.*$', '', name)
    name = re.sub(r'\s*[–—]\s*.*$', '', name)
    name = re.sub(r'\s*\(.*?\)\s*', ' ', name)
    name = name.strip(' .,;:!?"\'')
    return name


def search_foursquare(venue: str, city: str, api_key: str) -> dict | None:
    """Search Foursquare Places API (new endpoint) for a venue."""
    search_city = CITY_SEARCH_NAMES.get(city, city)
    params = urllib.parse.urlencode({
        'query': venue,
        'near': search_city,
        'limit': 1,
    })
    url = f'https://places-api.foursquare.com/places/search?{params}'
    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {api_key}',
        'X-Places-Api-Version': '2025-06-17',
    }

    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            results = data.get('results', [])
            if results:
                p = results[0]
                loc = p.get('location', {})
                lat = p.get('latitude')
                lng = p.get('longitude')

                address = loc.get('formatted_address', '')
                if not address:
                    parts = []
                    if loc.get('address'):
                        parts.append(loc['address'])
                    if loc.get('locality'):
                        parts.append(loc['locality'])
                    if loc.get('region'):
                        parts.append(loc['region'])
                    if loc.get('postcode'):
                        parts.append(loc['postcode'])
                    address = ', '.join(parts)

                return {
                    'name': p.get('name', ''),
                    'address': address,
                    'lat': lat,
                    'lng': lng,
                }
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print('Rate limited! Waiting 5s...', end=' ', flush=True)
            time.sleep(5)
        else:
            print(f'API error {e.code}', end=' ', flush=True)
    except (urllib.error.URLError, json.JSONDecodeError, KeyError, ValueError) as e:
        print(f'Error: {e}', end=' ', flush=True)
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--limit', type=int, default=50)
    args = parser.parse_args()

    api_key = os.environ.get('FOURSQUARE_API_KEY', '')
    if not api_key and not args.dry_run:
        print('ERROR: Set FOURSQUARE_API_KEY environment variable')
        sys.exit(1)

    print('=' * 60)
    print('  RESTAURANT ADDRESS LOOKUP (Foursquare)')
    print('=' * 60)

    candidates = []
    for path in sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md'))):
        with open(path) as f:
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

        loc = fm.get('location', '')
        city = fm.get('city', '')
        if not loc or not city or fm.get('address') or fm.get('coordinates'):
            continue
        if city not in REAL_CITIES or not is_good_venue_name(loc):
            continue

        candidates.append((path, fm, parts, loc, city))

    # Sort newest first so recent imports get geocoded before the backlog
    candidates.sort(key=lambda c: c[1].get('pubDate', ''), reverse=True)

    total = min(args.limit, len(candidates))
    print(f'Candidates: {len(candidates)}')
    print(f'Processing: {total}')
    print(f'Est. time: ~{total // 3}s\n')

    updated = 0
    not_found = 0
    for i, (path, fm, parts, loc, city) in enumerate(candidates[:args.limit]):
        venue = clean_venue_name(loc)
        print(f'  [{i+1}/{total}] {venue[:35]:35s} {city:20s}', end=' ', flush=True)

        if args.dry_run:
            print('(dry run)')
            continue

        result = search_foursquare(venue, city, api_key)

        if result and result.get('lat') and result.get('lng'):
            if result.get('name'):
                fm['location'] = result['name']
            if result.get('address'):
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

            name = result.get('name', venue)[:30]
            addr = result.get('address', '')[:40]
            print(f'✓ {name} — {addr}')
            updated += 1
        else:
            print('✗')
            not_found += 1

        time.sleep(0.3)

    print(f'\nUpdated: {updated} | Not found: {not_found}')


if __name__ == '__main__':
    main()
