#!/usr/bin/env python3
"""
Backfill location data into existing Instagram posts.

Reads the Instagram JSON export and matches posts to existing Markdown files,
adding GPS coordinates, venue names, and city info to frontmatter.
"""

import json
import os
import re
import sys
from datetime import datetime
from difflib import SequenceMatcher

import yaml

# Import shared functions from the main import script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_instagram import (
    fix_encoding, get_post_date, extract_location, extract_hashtags,
    clean_caption, extract_venue_from_caption, CITY_REGIONS,
    DATA_DIR, CONTENT_DIR,
)

def main():
    print('=' * 60)
    print('  BACKFILL LOCATION DATA')
    print('=' * 60)

    # Load Instagram data
    posts_json = os.path.join(DATA_DIR, 'your_instagram_activity', 'media', 'posts_1.json')
    if not os.path.exists(posts_json):
        print(f'ERROR: {posts_json} not found')
        sys.exit(1)

    with open(posts_json, encoding='utf-8') as f:
        ig_posts = json.load(f)

    print(f'Instagram posts in export: {len(ig_posts)}')

    # Build lookup from Instagram posts by date + title similarity
    ig_lookup = []
    for post in ig_posts:
        raw_title = post.get('title', '') or ''
        title = fix_encoding(raw_title)
        date = get_post_date(post)
        location = extract_location(post)
        hashtags = extract_hashtags(raw_title)
        caption = clean_caption(raw_title)

        ig_lookup.append({
            'title': title,
            'date': date.strftime('%Y-%m-%d'),
            'location': location,
            'hashtags': hashtags,
            'caption': caption,
        })

    # Scan existing posts
    import glob as globmod
    md_files = globmod.glob(os.path.join(CONTENT_DIR, '*.md'))
    print(f'Existing Markdown files: {len(md_files)}')

    updated = 0
    gps_added = 0
    city_added = 0
    venue_added = 0

    for md_path in sorted(md_files):
        with open(md_path, encoding='utf-8') as fh:
            content = fh.read()

        parts = content.split('---', 2)
        if len(parts) < 3:
            continue

        try:
            fm = yaml.safe_load(parts[1])
        except Exception:
            continue

        if fm.get('source') != 'instagram':
            continue

        # Skip if already has coordinates and city
        has_coords = 'coordinates' in fm
        has_city = 'city' in fm and fm['city']
        has_location = 'location' in fm and fm['location']

        if has_coords and has_city and has_location:
            continue

        # Try to match to Instagram export by date
        post_date = str(fm.get('pubDate', ''))[:10]
        post_title = (fm.get('title', '') or '').lower()[:100]

        best_match = None
        best_score = 0
        for ig in ig_lookup:
            if ig['date'] != post_date:
                continue
            score = SequenceMatcher(None, post_title, ig['title'].lower()[:100]).ratio()
            if score > best_score:
                best_score = score
                best_match = ig

        if not best_match or best_score < 0.4:
            continue

        changed = False

        # Add GPS coordinates
        if not has_coords and best_match['location']:
            fm['coordinates'] = {
                'lat': round(best_match['location']['lat'], 6),
                'lng': round(best_match['location']['lng'], 6),
            }
            gps_added += 1
            changed = True

        # Extract venue/city from caption
        venue_info = extract_venue_from_caption(
            best_match['caption'], best_match['hashtags']
        )

        if not has_location and venue_info.get('location'):
            fm['location'] = venue_info['location']
            venue_added += 1
            changed = True

        if not has_city and venue_info.get('city'):
            fm['city'] = venue_info['city']
            if venue_info.get('region'):
                fm['region'] = venue_info['region']
            city_added += 1
            changed = True

        if changed:
            # Rewrite the file with updated frontmatter
            yaml_str = yaml.dump(fm, default_flow_style=False,
                                 allow_unicode=True, sort_keys=False, width=1000)
            with open(md_path, 'w', encoding='utf-8') as fh:
                fh.write('---\n')
                fh.write(yaml_str)
                fh.write('---')
                fh.write(parts[2])
            updated += 1

    print(f'\nResults:')
    print(f'  Posts updated: {updated}')
    print(f'  GPS coordinates added: {gps_added}')
    print(f'  City/region added: {city_added}')
    print(f'  Venue names added: {venue_added}')
    print(f'\nBackfill complete!')


if __name__ == '__main__':
    main()
